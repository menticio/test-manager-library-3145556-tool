# test-manager-library-3145556-tool

> **Prueba técnica · Ficha ADSO 3145556**
> Entrega: **martes 13 de octubre de 2026, a las 5:00 p. m.** (17:00, hora Colombia).

Este repositorio guarda las **utilidades** de *Manager Library*: el sembrador de datos de demostración, que usa la API. **Empieza vacío a propósito**: se construye en el fork de cada aprendiz.

## Instrucciones

Cada aprendiz debe **crear el fork** de los seis repositorios del proyecto y **resolver el proyecto
con el spec planteado**.

1. Hacer fork, a su cuenta de GitHub, de cada repositorio de la tabla del final.
2. Leer el spec en [`test-manager-library-3145556-docs`](https://github.com/code-sena/test-manager-library-3145556-docs).
   Se entrega en dos versiones: `spec-python/` y `spec-.net/`.
3. Desarrollar en los forks.

## El reto se desarrolla con React y PHP (Laravel)

El spec está escrito para Python y para .NET, pero el reto **no** se hace en esos lenguajes:

| Capa | Tecnología del reto |
|---|---|
| Frontend | React |
| Backend | PHP con Laravel |

Lo que el spec define sobre el negocio —historias, criterios de aceptación, reglas, contrato de la
API, modelo de datos— se respeta. Lo que define sobre la tecnología se traduce a React y Laravel.

## La prueba no consiste en escribir el código

El propósito principal es ver la **capacidad de desempeño con SDD** (*Spec-Driven Development*,
desarrollo guiado por especificación): cómo se lee, se interpreta y se aplica una especificación
para llevarla a un stack distinto. El código es el medio, no el fin.

## Entrega

Cuenta lo que quede **subido a los forks antes de las 5:00 p. m.** (17:00). Lo que llegue después no se revisa.
No hay prórroga: suban avances parciales con commits pequeños durante la prueba.

## Los seis repositorios

| Repositorio | Qué va ahí |
|---|---|
| [`test-manager-library-3145556-docs`](https://github.com/code-sena/test-manager-library-3145556-docs) | El spec: `spec-python/` y `spec-.net/` |
| [`test-manager-library-3145556-api`](https://github.com/code-sena/test-manager-library-3145556-api) | Backend en PHP (Laravel) |
| [`test-manager-library-3145556-app`](https://github.com/code-sena/test-manager-library-3145556-app) | Frontend en React |
| [`test-manager-library-3145556-page`](https://github.com/code-sena/test-manager-library-3145556-page) | Sitio público estático de presentación |
| [`test-manager-library-3145556-infra`](https://github.com/code-sena/test-manager-library-3145556-infra) | Contenedores, red, volúmenes y motor de base de datos vacío |
| [`test-manager-library-3145556-tool`](https://github.com/code-sena/test-manager-library-3145556-tool) | Utilidades: sembrador de datos de demostración |

## Sembrador de demostración (T-21)

`seed.mjs` es Node.js 22 **sin dependencias** y usa **solo la API** (`data-model.md` §9: el sembrador nunca usa SQL).
Necesita `API_URL` (por defecto `http://localhost:8000/api/v1`), `ADMIN_USERNAME` y `ADMIN_PASSWORD` del entorno; no imprime
ningún secreto. Los pasos completos están en el README de `infra`.

| Fase | API con | Qué crea |
|---|---|---|
| `node seed.mjs past` | `CLOCK_OFFSET_DAYS=-20` | 40 libros (8 por categoría), 10 socios, 5 préstamos: 3 sin devolver (quedan vencidos) y 2 devueltos |
| `node seed.mjs present` | `CLOCK_OFFSET_DAYS=0` | 10 préstamos más (15 en total), comprueba que un socio con vencidos es rechazado y verifica el resultado |

El script comprueba el reloj de la API leyendo el `iat` del token: no hace falta ningún endpoint extra.

### Evidencia

```text
✓ Fase pasado: 40 libros, 10 socios, 5 préstamos (3 quedarán vencidos).
✓ Fase presente: 10 préstamos nuevos (15 en total).
✓ /loans/overdue devuelve 3 líneas: Cien años de soledad (6 días), Breve historia del tiempo (6 días), Código limpio (6 días)
✓ Reporte 2026-09-13 a 2026-10-13: 12 filas; primero «María» con 4 préstamos.
```

## Requisitos no funcionales (RNF-1 y RNF-2)

| Comando | Qué prueba | Resultado obtenido |
|---|---|---|
| `node seed.mjs race` | RNF-2 / ADR-002: dos `POST /loans` **simultáneos** del último ejemplar (API con 4 workers) | `1 con 201, 1 con 409 BOOK_NOT_AVAILABLE; disponibles después: 0` (repetido dos veces) |
| `node seed.mjs load` | RNF-1: catálogo de 5 000 libros creado por la API y 20 búsquedas (texto, categoría, páginas) | `mediana 19 ms, máxima 25 ms` (límite: 300 ms) |
