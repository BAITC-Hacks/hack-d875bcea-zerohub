"""Check a running deployment. --write creates two scenarios; --analysis may call AI."""

import argparse
import copy
import json
import urllib.error
import urllib.request


def check(base, write=False, analysis=False):
    def request(path, payload=None, expected=200):
        data = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request(
            base.rstrip("/") + "/api" + path,
            data=data,
            headers={"Content-Type": "application/json"} if data is not None else {},
        )
        try:
            with urllib.request.urlopen(req, timeout=65) as response:
                status, raw = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, raw = error.code, error.read()
        if status != expected:
            raise RuntimeError(f"{path}: expected HTTP {expected}, received {status}")
        return json.loads(raw)

    health = request("/health")
    config = request("/config")
    if config != request("/config"):
        raise RuntimeError("Initial configuration changed between requests")
    print(
        f"PASS health and shared configuration; analysis source: {health['analysis_source']}"
    )
    if not write:
        return
    decisions = []
    for index, category in enumerate(
        ("transport", "greening", "social", "safety", "services")
    ):
        choices = sorted(
            (i for i in config["initiatives"] if i["category"] == category),
            key=lambda i: i["cost"],
        )
        measure = choices[1]
        eligible = measure["eligible_district_ids"]
        decisions.append(
            {
                "initiative_id": measure["id"],
                "district_id": eligible[index % len(eligible)],
            }
        )
    body = {"dataset_version": config["dataset_version"], "decisions": decisions}
    preview = request("/preview", body)
    first = request("/scenarios", body, 201)
    if (
        first["final"] != preview["final"]
        or first["total_cost"] > config["initial_budget"]
    ):
        raise RuntimeError("Saved scenario does not match the budget-valid preview")
    if request("/scenarios/" + first["id"]) != first:
        raise RuntimeError("Scenario persistence mismatch")
    over = copy.deepcopy(body)
    for index, category in enumerate(
        ("transport", "greening", "social", "safety", "services")
    ):
        highest = max(
            (i for i in config["initiatives"] if i["category"] == category),
            key=lambda i: i["cost"],
        )
        over["decisions"][index] = {
            "initiative_id": highest["id"],
            "district_id": highest["eligible_district_ids"][0],
        }
    request("/scenarios", over, 422)
    changed = copy.deepcopy(body)
    lowest = min(
        (i for i in config["initiatives"] if i["category"] == "transport"),
        key=lambda i: i["cost"],
    )
    changed["decisions"][0] = {
        "initiative_id": lowest["id"],
        "district_id": lowest["eligible_district_ids"][0],
    }
    second = request("/scenarios", changed, 201)
    if first["final"]["score"] == second["final"]["score"]:
        raise RuntimeError("Changed decisions did not change the score")
    print("PASS save/reload, preview consistency, overrun rejection, changed score")
    if analysis:
        report = request("/scenarios/" + first["id"] + "/analysis", {})
        if report["source"] != health["analysis_source"] or not report["summary"]:
            raise RuntimeError("Analysis missing or source mismatch")
        print("PASS analysis returned; source: " + report["source"])
    print("Created scenario IDs: " + first["id"] + ", " + second["id"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8080")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--analysis", action="store_true")
    args = parser.parse_args()
    if args.analysis and not args.write:
        parser.error("--analysis requires --write")
    check(args.url, args.write, args.analysis)
