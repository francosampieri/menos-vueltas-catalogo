"""Allowlist defensiva para los artefactos públicos del catálogo."""

import json
import sys

PUBLIC_FIELDS = {
    "productos": (
        "Id", "Activo", "Cat B2C", "Cat B2B", "Producto", "Marca", "Tamaño", "UM",
        "Categoria", "Subcategoria", "Tags", "Id_Grupo", "Tipo_Variante",
        "Label_Variante", "Label_Tamaño", "Imagen", "Tipo", "Sin_Stock",
    ),
    "grupos": ("Id_Grupo", "Nombre_Grupo", "Marca", "Categoria", "Subcategoria"),
    "precios_b2c": (
        "Id", "Producto", "Estado", "Categoría", "Subcategoria", "Tipo",
        "Precio_Venta", "Uni Dto", "Dto", "Precio_Mayorista", "promo",
        "Precio_Promo", "Precio_Promo_Mayorista",
    ),
    "precios_b2b": (
        "Id", "Producto", "Estado", "Categoría", "Subcategoria", "Tipo",
        "Precio_Venta", "Uni Dto", "Dto", "Precio_Mayorista", "promo",
        "Precio_Promo", "Precio_Promo_Mayorista",
    ),
}

PROHIBITED_PUBLIC_FIELDS = {
    "Id_Proveedor", "Id_proveedor", "Codigo_Proveedor", "Modalidad_Abastecimiento",
    "Proveedor", "Saldo", "Precio_Costo", "Costo", "Costo_Unitario", "Markup",
    "Ganancia_Bruta", "Strat", "Telefono", "Direccion", "Notas", "Movimientos_Stock",
    "Proveedor_Efectivo",
}


def _normalizar_sin_stock(value):
    """Convierte la señal publicada desde CSV en el único booleano público."""
    return value is True or (isinstance(value, str) and value.strip().upper() == "TRUE")


def _allowlist_row(row, fields):
    public_row = {field: row.get(field, "") for field in fields}
    if "Sin_Stock" in fields:
        public_row["Sin_Stock"] = _normalizar_sin_stock(row.get("Sin_Stock"))
    return public_row


def filtrar_catalogo_publico(catalog):
    """Devuelve una copia que contiene sólo campos públicos conocidos."""
    filtered = {
        table: [_allowlist_row(row, fields) for row in catalog.get(table, [])]
        for table, fields in PUBLIC_FIELDS.items()
    }
    assert_catalogo_publico(filtered)
    return filtered


def assert_catalogo_publico(catalog):
    for table, fields in PUBLIC_FIELDS.items():
        allowed = set(fields)
        for row in catalog.get(table, []):
            unexpected = set(row) - allowed
            prohibited = set(row) & PROHIBITED_PUBLIC_FIELDS
            if unexpected or prohibited:
                raise ValueError(
                    "El catálogo público contiene campos no permitidos en "
                    f"{table}: {sorted(unexpected | prohibited)}"
                )


def _sanitize_file(path):
    with open(path, encoding="utf-8") as source:
        catalog = json.load(source)
    with open(path, "w", encoding="utf-8", newline="\n") as destination:
        json.dump(filtrar_catalogo_publico(catalog), destination, ensure_ascii=False, indent=2)
        destination.write("\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Uso: catalog_privacy.py <catalogo.json>")
    _sanitize_file(sys.argv[1])
