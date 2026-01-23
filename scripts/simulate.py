import argparse
import asyncio
import random
import statistics
import time
from dataclasses import dataclass, field
from typing import Iterable, List, Tuple

import aiohttp


DEFAULT_BASE_URL = "http://localhost:8081"
DEFAULT_LAT = 37.7749
DEFAULT_LNG = -122.4194


@dataclass
class Metrics:
    sent: int = 0
    success: int = 0
    errors: int = 0
    latencies_ms: List[float] = field(default_factory=list)

    def record(self, ok: bool, latency_ms: float) -> None:
        self.sent += 1
        if ok:
            self.success += 1
        else:
            self.errors += 1
        self.latencies_ms.append(latency_ms)

    def summary(self) -> str:
        if not self.latencies_ms:
            return "no samples"
        latencies = sorted(self.latencies_ms)
        p50 = latencies[int(0.50 * (len(latencies) - 1))]
        p95 = latencies[int(0.95 * (len(latencies) - 1))]
        avg = statistics.fmean(latencies)
        return (
            f"sent={self.sent} success={self.success} errors={self.errors} "
            f"avg={avg:.1f}ms p50={p50:.1f}ms p95={p95:.1f}ms"
        )


def parse_points(points_raw: str) -> List[Tuple[float, float]]:
    if not points_raw:
        return [(DEFAULT_LAT, DEFAULT_LNG)]
    points = []
    for chunk in points_raw.split(";"):
        lat_str, lng_str = chunk.split(",")
        points.append((float(lat_str.strip()), float(lng_str.strip())))
    return points


def build_driver_ids(count: int, prefix: str) -> List[str]:
    return [f"{prefix}{i:06d}" for i in range(1, count + 1)]


async def post_json(session: aiohttp.ClientSession, url: str, payload: dict) -> Tuple[bool, float]:
    start = time.perf_counter()
    ok = False
    try:
        async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=2)) as response:
            await response.read()
            ok = 200 <= response.status < 300
    except Exception:
        ok = False
    latency_ms = (time.perf_counter() - start) * 1000.0
    return ok, latency_ms


async def get_json(session: aiohttp.ClientSession, url: str) -> Tuple[bool, float, dict]:
    start = time.perf_counter()
    ok = False
    payload = {}
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=2)) as response:
            ok = 200 <= response.status < 300
            payload = await response.json()
    except Exception:
        ok = False
        payload = {}
    latency_ms = (time.perf_counter() - start) * 1000.0
    return ok, latency_ms, payload


async def ingest_worker(
    session: aiohttp.ClientSession,
    url: str,
    driver_ids: List[str],
    points: List[Tuple[float, float]],
    rps: float,
    metrics: Metrics,
    stop_at: float,
) -> None:
    if rps <= 0:
        return
    interval = 1.0 / rps
    idx = 0
    while time.perf_counter() < stop_at:
        driver_id = driver_ids[idx % len(driver_ids)]
        lat, lng = points[idx % len(points)]
        payload = {"driverId": driver_id, "lat": lat, "lng": lng}
        ok, latency = await post_json(session, url, payload)
        metrics.record(ok, latency)
        idx += 1
        elapsed = latency / 1000.0
        sleep_for = interval - elapsed
        if sleep_for > 0:
            await asyncio.sleep(sleep_for)


async def run_ingestion(
    base_url: str,
    driver_ids: List[str],
    points: List[Tuple[float, float]],
    rps: float,
    duration: float,
    concurrency: int,
) -> Metrics:
    url = f"{base_url}/driver/location"
    metrics = Metrics()
    stop_at = time.perf_counter() + duration
    per_worker_rps = rps / max(concurrency, 1)
    connector = aiohttp.TCPConnector(limit=concurrency * 2)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [
            asyncio.create_task(
                ingest_worker(session, url, driver_ids, points, per_worker_rps, metrics, stop_at)
            )
            for _ in range(concurrency)
        ]
        await asyncio.gather(*tasks)
    return metrics


async def sample_price(
    base_url: str,
    point: Tuple[float, float],
    samples: int,
    interval: float,
) -> Tuple[Metrics, List[dict]]:
    url = f"{base_url}/price?lat={point[0]}&lng={point[1]}"
    metrics = Metrics()
    payloads = []
    async with aiohttp.ClientSession() as session:
        for _ in range(samples):
            ok, latency, payload = await get_json(session, url)
            metrics.record(ok, latency)
            if payload:
                payloads.append(payload)
            await asyncio.sleep(interval)
    return metrics, payloads


async def run_price_load(
    base_url: str,
    point: Tuple[float, float],
    rps: float,
    duration: float,
    concurrency: int,
) -> Metrics:
    url = f"{base_url}/price?lat={point[0]}&lng={point[1]}"
    metrics = Metrics()
    stop_at = time.perf_counter() + duration
    per_worker_rps = rps / max(concurrency, 1)
    connector = aiohttp.TCPConnector(limit=concurrency * 2)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [
            asyncio.create_task(price_worker(session, url, per_worker_rps, metrics, stop_at))
            for _ in range(concurrency)
        ]
        await asyncio.gather(*tasks)
    return metrics


async def price_worker(
    session: aiohttp.ClientSession,
    url: str,
    rps: float,
    metrics: Metrics,
    stop_at: float,
) -> None:
    if rps <= 0:
        return
    interval = 1.0 / rps
    while time.perf_counter() < stop_at:
        ok, latency, _ = await get_json(session, url)
        metrics.record(ok, latency)
        elapsed = latency / 1000.0
        sleep_for = interval - elapsed
        if sleep_for > 0:
            await asyncio.sleep(sleep_for)


async def scenario_full(args: argparse.Namespace) -> None:
    points = parse_points(args.points)
    primary_point = points[0]
    driver_ids = build_driver_ids(args.drivers, args.driver_prefix)

    print("Phase 1: warmup ingestion")
    warmup_metrics = await run_ingestion(
        args.base_url,
        driver_ids,
        points,
        args.rps,
        args.warmup_seconds,
        args.concurrency,
    )
    print(f"Warmup metrics: {warmup_metrics.summary()}")

    price_metrics, payloads = await sample_price(
        args.base_url,
        primary_point,
        samples=3,
        interval=1.0,
    )
    if payloads:
        print(f"Baseline price sample: {payloads[-1]}")
    print(f"Price sample metrics: {price_metrics.summary()}")

    drop_count = int(len(driver_ids) * args.drop_ratio)
    remaining_drivers = driver_ids[: max(len(driver_ids) - drop_count, 1)]

    print("Phase 2: driver drop ingestion")
    drop_metrics = await run_ingestion(
        args.base_url,
        remaining_drivers,
        points,
        args.rps * (len(remaining_drivers) / len(driver_ids)),
        args.drop_seconds,
        args.concurrency,
    )
    print(f"Drop metrics: {drop_metrics.summary()}")

    if args.data_freshness_wait > 0:
        print(f"Waiting {args.data_freshness_wait}s for freshness window...")
        await asyncio.sleep(args.data_freshness_wait)

    price_metrics, payloads = await sample_price(
        args.base_url,
        primary_point,
        samples=3,
        interval=1.0,
    )
    if payloads:
        print(f"Post-drop price sample: {payloads[-1]}")
    print(f"Post-drop price metrics: {price_metrics.summary()}")

    print("Phase 3: ingestion pause")
    await asyncio.sleep(args.pause_seconds)
    price_metrics, payloads = await sample_price(
        args.base_url,
        primary_point,
        samples=3,
        interval=1.0,
    )
    if payloads:
        print(f"Post-pause price sample: {payloads[-1]}")
    print(f"Post-pause price metrics: {price_metrics.summary()}")


async def run_ingest_only(args: argparse.Namespace) -> None:
    points = parse_points(args.points)
    driver_ids = build_driver_ids(args.drivers, args.driver_prefix)
    metrics = await run_ingestion(
        args.base_url, driver_ids, points, args.rps, args.duration, args.concurrency
    )
    print(metrics.summary())


async def run_price_only(args: argparse.Namespace) -> None:
    points = parse_points(args.points)
    metrics = await run_price_load(
        args.base_url, points[0], args.rps, args.duration, args.concurrency
    )
    print(metrics.summary())


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Surge pricing simulation utilities")
    subparsers = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--base-url", default=DEFAULT_BASE_URL)
    common.add_argument("--points", default=f"{DEFAULT_LAT},{DEFAULT_LNG}")
    common.add_argument("--concurrency", type=int, default=20)
    common.add_argument("--driver-prefix", default="driver_")

    ingest = subparsers.add_parser("ingest", parents=[common])
    ingest.add_argument("--drivers", type=int, default=2000)
    ingest.add_argument("--rps", type=float, default=5000)
    ingest.add_argument("--duration", type=float, default=30)
    ingest.set_defaults(func=run_ingest_only)

    price = subparsers.add_parser("price", parents=[common])
    price.add_argument("--rps", type=float, default=10000)
    price.add_argument("--duration", type=float, default=20)
    price.set_defaults(func=run_price_only)

    scenario = subparsers.add_parser("scenario", parents=[common])
    scenario.add_argument("--drivers", type=int, default=2000)
    scenario.add_argument("--rps", type=float, default=5000)
    scenario.add_argument("--warmup-seconds", type=float, default=40)
    scenario.add_argument("--drop-seconds", type=float, default=40)
    scenario.add_argument("--drop-ratio", type=float, default=0.5)
    scenario.add_argument("--data-freshness-wait", type=float, default=35)
    scenario.add_argument("--pause-seconds", type=float, default=5)
    scenario.set_defaults(func=scenario_full)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    asyncio.run(args.func(args))


if __name__ == "__main__":
    main()
