# Guía Paso a Paso: Cómo Duplicar este Sistema

Esta guía te explicará cómo clonar este proyecto de forma que tengas un **sistema totalmente independiente** con su propia base de datos, autenticación y alojamiento.

## 1. Descargar y preparar el código localmente

Primero, debes descargar el código actual a tu computadora (si es que no lo tienes ya), o crear una copia de la carpeta si quieres empezar de cero.

Si lo vas a clonar desde GitHub:
```bash
git clone <URL_DE_TU_REPOSITORIO_ACTUAL> nuevo-sistema
cd nuevo-sistema
```

Una vez dentro de la carpeta `nuevo-sistema`, borraremos el historial de Git anterior para que este sea un proyecto limpio:

**En Windows (CMD):**
```cmd
rmdir /s /q .git
```
**En Mac/Linux:**
```bash
rm -rf .git
```

Luego, inicializa un nuevo repositorio:
```bash
git init
git add .
git commit -m "Commit inicial: sistema duplicado"
```

---

## 2. Crear un Nuevo Proyecto en Firebase

Este sistema utiliza Firebase para la Base de Datos, Imágenes (Storage) y Usuarios (Auth). Necesitas crear un proyecto nuevo para no mezclar los datos.

1. Ve a la [Consola de Firebase](https://console.firebase.google.com/).
2. Haz clic en **"Agregar proyecto"** (Add project).
3. Escribe el nombre de tu nuevo sistema (ej. `mi-nuevo-pos`) y sigue los pasos para crearlo (puedes desactivar Google Analytics por ahora).
4. Cuando el proyecto esté listo, en la pantalla principal (Project Overview), haz clic en el ícono de **Web (`</>`)** para registrar una aplicación web.
5. Ponle un apodo (ej. `web-app`) y **marca la casilla** "Configurar también Firebase Hosting para esta app".
6. Haz clic en "Registrar app" y Firebase te mostrará un código (Firebase SDK). **Copia ese bloque de código** (lo usaremos en el paso 4). Luego dale a "Siguiente" hasta terminar.

---

## 3. Configurar los Servicios en tu Nuevo Firebase

En la barra izquierda de tu nuevo proyecto en Firebase, debes habilitar 3 cosas:

### A. Authentication (Usuarios)
1. Ve a **Build > Authentication**.
2. Haz clic en **Get Started**.
3. En la pestaña "Sign-in method" (Método de inicio de sesión), añade **Email/Password** y actívalo. (Ojo: no actives "Email link").

### B. Firestore Database (Base de Datos)
1. Ve a **Build > Firestore Database**.
2. Haz clic en **Create database**.
3. Selecciona tu ubicación (ej. `nam5 (us-central)` o alguna en Sudamérica si prefieres).
4. Inicia en modo **Producción** (o modo prueba, pero luego deberás cambiar las reglas).
5. Ve a la pestaña **Reglas (Rules)** y pega esto para permitir lectura/escritura a usuarios logueados (como el sistema original):
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   *Nota: En un entorno de producción estricto, querrás reglas más restrictivas, pero esto replica el comportamiento base.*

### C. Storage (Imágenes)
1. Ve a **Build > Storage**.
2. Haz clic en **Get Started**.
3. Elige modo producción.
4. Ve a la pestaña **Reglas (Rules)** y pega esto:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

---

## 4. Conectar tu Código Local al Nuevo Firebase

Abre el proyecto `nuevo-sistema` en tu editor de código (como VS Code).

### Archivo `services/firebase.ts`
Abre `services/firebase.ts`. Verás que hay unas variables `firebaseConfig` quemadas (hardcoded) y otras que vienen de `import.meta.env`.

Sustituye los valores hardcoded por los de **TU NUEVO PROYECTO** (los que te dio Firebase en el Paso 2).

Se verá algo así (pon TUS datos reales):
```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSy_TU_NUEVO_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tu-nuevo-proyecto.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tu-nuevo-proyecto",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tu-nuevo-proyecto.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdefg"
};
```

*(Si utilizas un archivo `.env`, asegúrate de actualizar los valores ahí también).*

### Archivo `.firebaserc`
Abre el archivo `.firebaserc` (en la raíz del proyecto) y cambia el `default` por el ID de tu nuevo proyecto:
```json
{
  "projects": {
    "default": "tu-nuevo-proyecto"
  }
}
```

### Archivo `firebase.json`
Abre el archivo `firebase.json` y asegúrate de actualizar el valor de `site`. Normalmente es igual al ID de tu proyecto.
```json
{
  "hosting": {
    "site": "tu-nuevo-proyecto",
    "public": "dist",
    ...
```

---

## 5. Cambiar Nombres e Identidad

Para que no siga diciendo "Piel Divina LG", cambia lo siguiente:

1. **`index.html`**:
   - Cambia el `<title>Piel Divina LG - Punto de Venta</title>` por tu nuevo nombre.
   - Cambia los nombres en las etiquetas `<meta name="description"...` y los íconos si deseas (los íconos están en la carpeta `public/`).
2. **`package.json`**:
   - Cambia el `"name": "piel-divina-pos"` por `"name": "mi-nuevo-pos"`.
3. **`utils/printReceipt.ts`**:
   - Busca el texto `"PIEL DIVINA LG"` y cámbialo por el nombre de tu nuevo negocio para que salga bien en los recibos impresos.
4. **Logos de la UI**:
   - Revisa componentes como `components/Layout.tsx` o la pantalla de Login y cambia el texto/logo principal según requieras.

---

## 6. Subir a un Nuevo Repositorio en GitHub

1. Ve a [GitHub](https://github.com/) y crea un **Nuevo Repositorio** (New Repository). Lámalo como quieras, por ejemplo, `mi-nuevo-pos`. Déjalo vacío (no marques la opción de añadir README ni gitignore).
2. GitHub te mostrará comandos para empujar un repositorio existente. Cópialos y pégalos en tu terminal local (dentro de tu proyecto):

```bash
git remote add origin https://github.com/TU_USUARIO/mi-nuevo-pos.git
git branch -M main
git push -u origin main
```
*Ahora tu código está en GitHub en tu nuevo repo.*

---

## 7. Configurar Despliegue Automático (Hosting)

El proyecto usa GitHub Actions para subir el código a Firebase automáticamente cuando haces un cambio (`.github/workflows/deploy.yml`). Para que el nuevo GitHub tenga permiso de subir al nuevo Firebase:

1. En tu terminal (local), asegúrate de tener las herramientas de firebase instaladas:
   ```bash
   npm install -g firebase-tools
   ```
2. Inicia sesión en Firebase:
   ```bash
   firebase login
   ```
3. Genera un token para GitHub (o usa el sistema de Workload Identity Federation de Google, pero esto es más rápido con el CLI):
   ```bash
   firebase init hosting:github
   ```
   - Te preguntará qué proyecto usar: selecciona tu nuevo proyecto.
   - Te pedirá iniciar sesión en GitHub para autorizar.
   - Te preguntará el nombre del repositorio: escribe `TU_USUARIO/mi-nuevo-pos`.
   - **IMPORTANTE:** Cuando te pregunte si deseas sobrescribir el flujo de trabajo (`deploy.yml` o similar) de GitHub Actions, dile **NO (N)** para que mantenga el archivo `.github/workflows/deploy.yml` que ya tienes personalizado para que solucione el bug del CLI.
   - Esto configurará automáticamente los "Secrets" (`FIREBASE_SERVICE_ACCOUNT...`) en los Settings de tu nuevo repositorio en GitHub.

*(Nota: si el paso `firebase init hosting:github` no funciona, tendrás que crear una Service Account en la consola de Google Cloud de tu proyecto de Firebase, generar una clave JSON, y pegarla como Secreto de GitHub con el nombre `FIREBASE_SERVICE_ACCOUNT` o el nombre exacto que use el archivo `.github/workflows/deploy.yml`).*

## 8. ¡Listo!

Haz algún cambio, súbelo a GitHub y verifica en la pestaña "Actions" de GitHub que el proyecto se haya compilado y desplegado correctamente en tu nuevo Firebase Hosting.

Para poder ingresar al sistema web, **no olvides crear tu primer usuario manualmente** yendo a la consola de Firebase -> Authentication -> Add User (agrega un correo y una contraseña). Ese será tu primer usuario administrador para iniciar sesión.
