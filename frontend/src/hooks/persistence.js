import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../auth";

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
    apiFetch(`/api/collections/${name}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        // Si el servidor respondió con error (403, 500, etc.) "data" no es un
        // arreglo — seguimos con [] en vez de tronar toda la pantalla.
        if (!r.ok || !Array.isArray(data)) throw new Error(data?.error || `No se pudo cargar "${name}" (${r.status})`);
        return data;
      })
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
      apiFetch(`/api/collections/${name}/${id}`, { method: "DELETE" }).catch((err) =>
        console.error(`No se pudo borrar de "${name}":`, err)
      );
    }
  });

  next.forEach((item) => {
    const before = prevById.get(String(item.id));
    if (before === item) return; // misma referencia, no cambió
    const method = before ? "PUT" : "POST";
    const url = before ? `/api/collections/${name}/${item.id}` : `/api/collections/${name}`;
    apiFetch(url, {
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
    apiFetch(`/api/lists/${name}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || `No se pudo cargar "${name}" (${r.status})`);
        return data;
      })
      .then((data) => {
        if (cancelado) return;
        if (Array.isArray(data) && data.length > 0) {
          setItemsRaw(data);
        } else {
          setItemsRaw(fallback);
          apiFetch(`/api/lists/${name}`, {
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
      apiFetch(`/api/lists/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch((err) => console.error(`No se pudo guardar "${name}":`, err));
      return next;
    });
  };

  // Actualiza el estado local SIN mandar el PUT (que es solo-admin). Sirve
  // para reflejar en pantalla algo que ya se guardó por otra vía — por
  // ejemplo, después de agregarValorLista().
  const setItemsLocal = (updater) => {
    setItemsRaw((prev) => (typeof updater === "function" ? updater(prev) : updater));
  };

  return [items, setItems, setItemsLocal];
}

/**
 * Agrega un solo valor a una lista simple sin necesitar permisos de admin —
 * usa la ruta dedicada del backend que solo permite agregar (nunca borrar ni
 * reemplazar toda la lista). Regresa la lista completa ya actualizada, para
 * poder reflejarla con setItemsLocal.
 */
export async function agregarValorLista(name, valor) {
  const r = await apiFetch(`/api/lists/${name}/agregar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valor }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error || `No se pudo agregar "${valor}" a "${name}"`);
  return data;
}
