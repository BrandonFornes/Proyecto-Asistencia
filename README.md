# 📋 AsistenciaFace

Sistema de asistencia escolar con reconocimiento facial.  
**Backend**: Python (FastAPI + face_recognition) · **Frontend**: React Native (Expo)

---

## 🏗️ Arquitectura

```
Teléfono del maestro  ──────────►  Computadora/Servidor
  (Expo / React Native)              (Python FastAPI)
  
  1. Toma foto del grupo
  2. Envía al backend  ───────────►  3. Detecta caras
                                      4. Compara con BD
                       ◄───────────  5. Devuelve lista
  6. Muestra resultados
  7. Guarda en Excel ◄────────────   (Excel en servidor)
```

> El teléfono y la computadora deben estar en la **misma red Wi-Fi**.

---

## 🖥️ Configuración del Backend (Computadora)

### Requisitos previos
- Python 3.9+
- `cmake` instalado (`brew install cmake` en Mac, `apt install cmake` en Ubuntu)
- `dlib` (se instala con face-recognition)

### 1. Crear entorno virtual
```bash
cd backend
python -m venv venv

# Mac/Linux:
source venv/bin/activate

# Windows:
venv\Scripts\activate
```

### 2. Instalar dependencias
```bash
pip install -r requirements.txt
```

> ⚠️ **Nota**: `face-recognition` requiere `dlib` que puede tardar varios minutos en compilar.

### 3. Iniciar el servidor
```bash
uvicorn main:app --reload
```
#--host 0.0.0.0 --port 8000
### 4. Verificar que funciona
Abre en el navegador: `http://localhost:8000`  
Debería aparecer: `{"message": "Sistema de Asistencia Facial activo 🎓"}`

### 5. Encontrar la IP de tu computadora
```bash
# Mac/Linux:
ifconfig | grep "inet "

# Windows:
ipconfig
```
Anota la IP local (ej: `192.168.1.100`)

---

## 📱 Configuración del Frontend (Teléfono)

### Requisitos previos
- Node.js 18+
- Expo CLI: `npm install -g @expo/cli`
- App **Expo Go** en tu teléfono (Android/iOS)

### 1. Instalar dependencias
```bash
cd frontend
npm install
```

### 2. Configurar la IP del servidor
Edita `App.js`, línea 18:
```javascript
const API_URL = 'http://TU_IP_AQUI:8000';  // ← Cambia esto
```
Pon la IP que obtuviste en el paso anterior.

### 3. Iniciar la app
```bash
npx expo start
```
Escanea el código QR con la app **Expo Go** en tu teléfono.

---

## 📖 Cómo usar la app

### Paso 1: Registrar alumnos
1. Ve a la pestaña **"Registrar"** (ícono de persona+)
2. Toca la foto para agregar una imagen del alumno
3. Puedes usar la cámara o importar desde galería
4. Ingresa nombre y matrícula/ID
5. Presiona **"Registrar Alumno"**

> 💡 **Tips para mejores resultados:**
> - Usa fotos claras, de frente, bien iluminadas
> - Una foto por alumno (cara visible)
> - Puede agregar varias fotos del mismo alumno repitiendo el proceso

### Paso 2: Pasar asistencia
1. Ve a la pestaña **"Asistencia"** (ícono de cámara)
2. Selecciona el grupo en la esquina superior derecha
3. Toma una foto del salón o importa una
4. Presiona **"Pasar Asistencia"**
5. El sistema mostrará quién fue reconocido automáticamente

### Paso 3: Ver y descargar
- La lista de presentes del día aparece debajo
- Toca el ícono ⬇️ para descargar el Excel
- El Excel se guarda también en la computadora en `backend/attendance/`

---

## 📁 Estructura de archivos generados

```
backend/
├── students/          # Fotos de cada alumno
│   ├── A12345/
│   │   └── foto.jpg
│   └── A67890/
│       └── foto.jpg
├── attendance/        # Archivos Excel de asistencia
│   ├── Asistencia_3A_2024-09-15.xlsx
│   └── Asistencia_3A_2024-09-16.xlsx
└── encodings.json     # Base de datos de caras (auto-generado)
```

---

## 🔧 Endpoints de la API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/students` | Lista de alumnos registrados |
| POST | `/students/register` | Registrar nuevo alumno |
| DELETE | `/students/{id}` | Eliminar alumno |
| POST | `/attendance/recognize` | Procesar asistencia desde foto |
| GET | `/attendance/today` | Ver asistencia del día |
| GET | `/attendance/download` | Descargar Excel |
| GET | `/groups` | Lista de grupos |

Documentación interactiva: `http://localhost:8000/docs`

---

## 🐛 Solución de problemas

**"No se puede conectar al servidor"**
- Verifica que el servidor esté corriendo (`uvicorn main:app ...`)
- Confirma que el teléfono y la computadora están en la misma red Wi-Fi
- Revisa que la IP en `App.js` sea correcta
- Desactiva el firewall temporalmente o abre el puerto 8000

**"No se detectó ninguna cara"**
- Mejora la iluminación de la foto
- Asegúrate que las caras sean visibles y de frente

**"Error al instalar dlib/face-recognition"**
- Mac: `brew install cmake`
- Ubuntu: `sudo apt-get install cmake libopenblas-dev liblapack-dev`
- Windows: instala Visual Studio Build Tools

**El reconocimiento es impreciso**
- Registra el alumno con varias fotos (diferentes ángulos, iluminación)
- Ajusta la `tolerance` al procesar (0.4 = más estricto, 0.6 = más permisivo)

---

## 🔒 Privacidad

Los datos biométricos (encodings faciales) se almacenan **localmente** en tu computadora.
No se envían a ningún servicio externo. Las fotos también se guardan solo en tu máquina.
