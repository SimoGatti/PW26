"""Primitive condivise dai repository SQL e stato validato delle liste."""

from dataclasses import dataclass
from urllib.parse import urlencode
from django.db import connection

PAGE_SIZES = {10, 25, 50, 100}

def rows(cursor):
    """Converte il risultato del cursore in dizionari nominati."""
    columns = [c[0] for c in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]

def one(cursor):
    """Restituisce la prima riga oppure ``None``."""
    result = rows(cursor)
    return result[0] if result else None

def execute(sql, params=()):
    """Esegue SQL parametrizzato per le query semplici riutilizzabili."""
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        return rows(cursor) if cursor.description else []

@dataclass(frozen=True)
class ListState:
    """Rappresenta pagina, dimensione e ordinamento già normalizzati."""

    page: int
    size: int
    sort: str
    direction: str
    params: dict
    @property
    def offset(self): return (self.page - 1) * self.size
    def query(self, **overrides):
        """Genera una query string preservando soltanto valori significativi."""
        values = {k: v for k, v in self.params.items() if v not in (None, "")}
        values.update(overrides)
        return urlencode(values)

def list_state(request, allowed_sorts, default_sort):
    """Normalizza i parametri non fidati con whitelist e valori sicuri."""
    raw = request.GET
    try: page = max(1, int(raw.get("page", 1)))
    except ValueError: page = 1
    try: size = int(raw.get("size", 25))
    except ValueError: size = 25
    if size not in PAGE_SIZES: size = 25
    sort = raw.get("sort", default_sort)
    if sort not in allowed_sorts: sort = default_sort
    direction = raw.get("dir", "asc").lower()
    if direction not in {"asc", "desc"}: direction = "asc"
    params = {k: v for k, v in raw.items() if k != "page"}
    params["sort"], params["dir"], params["size"] = sort, direction, size
    return ListState(page, size, sort, direction, params)
