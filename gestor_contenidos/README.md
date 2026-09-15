# Gestor de Noticias y Guiones — Online

Aplicación web Node.js + Express + PostgreSQL preparada para desplegar en servicios como Render.

## Requisitos
- Node.js 20+
- PostgreSQL (por ejemplo Supabase)

## Variables de entorno
- `DATABASE_URL`: cadena de conexión PostgreSQL.
- `PORT`: la asigna automáticamente Render; en local se usa 3000.

## Ejecución local
```bash
npm install
npm start
```
Abrir http://localhost:3000

## Deploy en Render
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variable: `DATABASE_URL` = cadena PostgreSQL de Supabase

El servidor escucha en `0.0.0.0` y toma el puerto de `PORT`.

### Importante
La aplicación inicia el servidor HTTP aunque PostgreSQL tarde en responder. Esto evita que Render quede mostrando indefinidamente la pantalla de carga si `DATABASE_URL` está mal configurada o la base no responde. Revisá los logs del servicio si `/api/health` devuelve error.
