import { useEffect, useRef, useState } from "react";

/**
 * Reemplaza a useState([]) para un arreglo de objetos con "id" (recepciones,
 * conteos, borradores_conteo, salidas). Al montar, carga lo que ya existe en
 * la base de datos. Cada vez que se llama al setter (igual que un setState
 * normal — acepta valor directo o función), calcula qué cambió contra lo
 * anterior y manda solo esos cambios (crear / actualizar / borrar) al backend,
 * sin tocar la lógica de los formularios que ya usan este arreglo.
 */
export function usePersistedCollection(name) {
  const [items, setItemsRaw] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const prevRef = useRef([]);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/collections/${name}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return;
        prevRef.current = data;
        setItemsRaw(data);
        setLoaded(true);
      })
      .catch((err) => console.error(`No se pudo cargar "${name}":`, err));
    return () => { cancelado = true; };
  }, [name]);

  const setItems = (updater) => {
    setItemsRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      syncCollectionDiff(name, prevRef.current, next);
      prevRef.current = next;
      return next;
    });
  };

  return [items, setItems, loaded];
}

function syncCollectionDiff(name, prev, next) {
  const prevById = new Map(prev.map((x) => [String(x.id), x]));
  const nextIds = new Set(next.map((x) => String(x.id)));

  prevById.forEach((_, id) => {
    if (!nextIds.has(id)) {
      fetch(`/api/collections/${name}/${id}`, { method: "DELETE" }).catch((err) =>
        console.error(`No se pudo borrar de "${name}":`, err)
      );
    }
  });

  next.forEach((item) => {
    const before = prevById.get(String(item.id));
    if (before === item) return; // misma referencia, no cambió
    const method = before ? "PUT" : "POST";
    const url = before ? `/api/collections/${name}/${item.id}` : `/api/collections/${name}`;
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    }).catch((err) => console.error(`No se pudo guardar en "${name}":`, err));
  });
}

/**
 * Reemplaza a useState(valorInicial) para una lista simple (arreglo de
 * strings), como sucursales o catálogos de nombres. Si en el servidor
 * todavía no hay nada guardado, siembra el valor por default (el mismo que
 * traía el prototipo) y lo guarda de una vez.
 */
export function usePersistedList(name, fallback) {
  const [items, setItemsRaw] = useState(fallback);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/lists/${name}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return;
        if (Array.isArray(data) && data.length > 0) {
          setItemsRaw(data);
        } else {
          setItemsRaw(fallback);
          fetch(`/api/lists/${name}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fallback),
          }).catch((err) => console.error(`No se pudo inicializar "${name}":`, err));
        }
      })
      .catch((err) => console.error(`No se pudo cargar "${name}":`, err));
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const setItems = (updater) => {
    setItemsRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      fetch(`/api/lists/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch((err) => console.error(`No se pudo guardar "${name}":`, err));
      return next;
    });
  };

  return [items, setItems];
}
