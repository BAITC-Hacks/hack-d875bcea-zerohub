"""Opt-in real API smoke check. Requires an API key and may incur charges."""

import argparse
import asyncio

from app.services.team_advisor import TeamAdvisor
from scripts.person3_validate_data import validate


async def main():
    context = validate()[0][1]
    narrative = await TeamAdvisor().analyze(context)
    print(narrative.model_dump_json(indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--live", action="store_true", help="Authorize up to two real API calls"
    )
    if not parser.parse_args().live:
        parser.error("Pass --live to make a real API request")
    try:
        asyncio.run(main())
    except Exception as error:  # noqa: BLE001 - sanitize all CLI failures to avoid secret disclosure
        raise SystemExit(
            f"Live check failed ({type(error).__name__}). Check configuration and provider access."
        ) from None
