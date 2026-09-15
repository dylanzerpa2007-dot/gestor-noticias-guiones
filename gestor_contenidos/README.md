# Gestor de Noticias y Guiones - Online

Aplicación web con Node.js, Express y PostgreSQL, preparada para Render + Supabase.

## Funciones
- Noticias con título, link, descripción, persona que la cargó y fecha/hora automática.
- Guiones ilimitados vinculados a una noticia existente, con persona que lo cargó y fecha/hora automática.
- Estado editable para Noticias y Guiones: **Grabada / editada** y **Hecho**, ambos con indicador rojo (NO) o verde (SÍ).
- Eliminación automática de Noticias y Guiones después de 7 días desde su carga.
- Las noticias eliminadas arrastran sus guiones por la relación de base de datos.
- La antigüedad se calcula desde `fecha_creacion` y editar el contenido no reinicia el plazo.
- PostgreSQL con compatibilidad para Render + Supabase IPv4 mediante Session Pooler.

## Render
- Root Directory: `gestor_contenidos`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment variable: `DATABASE_URL` con la conexión de Supabase **Session Pooler / Session mode, puerto 5432**.

La aplicación crea/actualiza automáticamente las tablas y columnas necesarias al iniciar.
