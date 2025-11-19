#!/usr/bin/env python3
"""Genera un dataset unificado de terrenos desde fuentes crudas."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, List, Dict, Any

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUTPUT_FILE = ROOT / "docs" / "data" / "listings.json"


@dataclass
class Listing:
    id: str
    title: str
    terrain_type: str
    region: str
    commune: str
    price_clp: int
    surface_m2: float
    origin: str  # "portal" o "remate"
    source_name: str
    url: str
    fiscal_value: int | None
    commercial_value: int | None
    extra: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "terrain_type": self.terrain_type,
            "region": self.region,
            "commune": self.commune,
            "price_clp": self.price_clp,
            "surface_m2": self.surface_m2,
            "origin": self.origin,
            "source_name": self.source_name,
            "url": self.url,
            "fiscal_value": self.fiscal_value,
            "commercial_value": self.commercial_value,
            "extra": self.extra,
        }


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def parse_portal_a() -> Iterable[Listing]:
    for item in load_json(RAW_DIR / "portal_a.json"):
        yield Listing(
            id=f"PORTALA-{item['listing_id']}",
            title=item["title"],
            terrain_type=item["type"],
            region=item["region"],
            commune=item["commune"],
            price_clp=item["price_clp"],
            surface_m2=item["surface_m2"],
            origin="portal",
            source_name=item["portal"],
            url=item["url"],
            fiscal_value=item.get("fiscal_value"),
            commercial_value=item.get("commercial_value"),
            extra={},
        )


def parse_portal_b() -> Iterable[Listing]:
    for item in load_json(RAW_DIR / "portal_b.json"):
        yield Listing(
            id=f"PORTALB-{item['code']}",
            title=item["name"],
            terrain_type=item["category"],
            region=item["location"]["region"],
            commune=item["location"]["commune"],
            price_clp=item["amount"],
            surface_m2=item["size"],
            origin="portal",
            source_name=item["source"],
            url=item["link"],
            fiscal_value=item["avaluos"].get("fiscal"),
            commercial_value=item["avaluos"].get("commercial"),
            extra={},
        )


def parse_remates() -> Iterable[Listing]:
    for item in load_json(RAW_DIR / "remates.json"):
        extra = {"auction_date": item.get("auction_date"), "entity": item.get("entity")}
        yield Listing(
            id=item["id"],
            title=item["asset_name"],
            terrain_type=item["terrain_type"],
            region=item["region"],
            commune=item["commune"],
            price_clp=item["minimum_bid"],
            surface_m2=item["surface"],
            origin="remate",
            source_name=item["entity"],
            url=item["docs"],
            fiscal_value=item.get("avaluo_fiscal"),
            commercial_value=item.get("avaluo_comercial"),
            extra=extra,
        )


PARSERS: List[Callable[[], Iterable[Listing]]] = [
    parse_portal_a,
    parse_portal_b,
    parse_remates,
]


def main() -> None:
    listings: List[Dict[str, Any]] = []
    for parser in PARSERS:
        for listing in parser():
            listings.append(listing.to_dict())

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w", encoding="utf-8") as fh:
        json.dump({"generated_from": "local samples", "listings": listings}, fh, ensure_ascii=False, indent=2)

    print(f"Dataset unificado guardado en {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
