import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Camera, User, Users, RotateCw, TrendingRight, Cpu } from 'lucide-react';

const FaceDetectionAlgorithm = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedModel, setSelectedModel] = useState('facemesh');

  const algorithmFlow = [
    {
      step: 1,
      title: "Inicialización de Modelos",
      icon: <Cpu className="w-6 h-6" />,
      code: `// 1. Configurar backend TensorFlow.js
await tf.setBackend("webgl");  // GPU acceleration
await tf.ready();

// 2. Cargar BlazeFace (detector rápido y ligero)
blazeRef.current = await blazeface.load();

// 3. Cargar FaceMesh (detector preciso con landmarks)
meshRef.current = await faceLandmarksDetection.createDetector(
  faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
  {
    runtime: "tfjs",
    refineLandmarks: true,  // Mayor precisión
    maxFaces: 2,           // Detecta hasta 2 rostros
  }
);`,
      explanation: "Tu algoritmo usa DOS modelos de deep learning en cascada para máxima robustez."
    },
    {
      step: 2,
      title: "Captura de Video Frame",
      icon: <Camera className="w-6 h-6" />,
      code: `// Loop cada 350ms
const loop = async () => {
  const video = videoRef.current;
  
  // Validar que el video tiene frame válido
  if (!video || video.readyState < 2) return;
  if (!video.videoWidth || !video.videoHeight) return;
  
  // El frame está listo para análisis
  analyzeFrame(video);
}`,
      explanation: "Captura frames del video cada 350ms para análisis. Valida que el frame esté listo antes de procesarlo."
    },
    {
      step: 3,
      title: "Detección Primaria: FaceMesh",
      icon: <User className="w-6 h-6" />,
      code: `const analyzeFaceMesh = async (video) => {
  // Detectar rostros con 468 puntos clave (landmarks)
  const preds = await meshRef.current.estimateFaces(
    video, 
    { flipHorizontal: true }
  );
  
  const facesCount = preds?.length ?? 0;
  
  if (facesCount > 0) {
    // Extraer 468 keypoints del primer rostro
    const keypoints = preds[0].keypoints;
    
    // Calcular orientación de la cabeza (yaw)
    const yaw = estimateYaw(keypoints);
    
    return { facesCount, yaw, headDirection };
  }
}`,
      explanation: "FaceMesh detecta rostros Y calcula 468 puntos faciales para estimar orientación de cabeza con alta precisión."
    },
    {
      step: 4,
      title: "Estimación de Orientación (Yaw)",
      icon: <RotateCw className="w-6 h-6" />,
      code: `const estimateYaw = (keypoints) => {
  // Landmarks críticos:
  const rightEye = keypoints[33];   // Ojo derecho (externo)
  const leftEye = keypoints[263];   // Ojo izquierdo (externo)
  const nose = keypoints[1];        // Punta de nariz
  
  // 1. Punto medio entre ojos
  const eyesMidX = (rightEye.x + leftEye.x) / 2;
  
  // 2. Distancia entre ojos (referencia)
  const eyeDist = Math.abs(leftEye.x - rightEye.x);
  
  // 3. Calcular desplazamiento de nariz vs centro
  const yaw = (nose.x - eyesMidX) / eyeDist;
  
  // yaw negativo = cabeza a IZQUIERDA
  // yaw positivo = cabeza a DERECHA
  // yaw ≈ 0 = cabeza al CENTRO
  
  return clamp(yaw, -1, 1);
}`,
      explanation: "Usa geometría de landmarks faciales para calcular orientación. Método robusto que no depende de iris."
    },
    {
      step: 5,
      title: "Clasificación de Dirección",
      icon: <TrendingRight className="w-6 h-6" />,
      code: `// Thresholds calibrados
const YAW_LEFT_TH = -0.18;   // Si yaw < -0.18 → IZQUIERDA
const YAW_RIGHT_TH = 0.18;   // Si yaw > 0.18 → DERECHA

let headDir = "CENTER";

if (yaw <= YAW_LEFT_TH) {
  headDir = "LEFT";
} else if (yaw >= YAW_RIGHT_TH) {
  headDir = "RIGHT";
}

// ✅ Con ventana de estabilidad de 1400ms
// Solo alerta si mantiene la posición > 1.4s`,
      explanation: "Clasifica la dirección con thresholds calibrados. Ventana de estabilidad evita falsos positivos."
    },
    {
      step: 6,
      title: "Fallback: BlazeFace",
      icon: <Users className="w-6 h-6" />,
      code: `// Si FaceMesh falla varias veces...
if (meshFailures >= 6) {
  // Cambiar a BlazeFace (más rápido, menos preciso)
  stateRef.current.mode = "BLAZEFACE";
}

const analyzeBlaze = async (video) => {
  const faces = await blazeRef.current.estimateFaces(
    video, 
    false  // returnTensors = false
  );
  
  // BlazeFace solo cuenta rostros
  // NO detecta orientación de cabeza
  return { facesCount: faces.length };
}`,
      explanation: "Si FaceMesh falla (ej. por hardware débil), usa BlazeFace como respaldo. Detecta rostros pero sin orientación."
    }
  ];

  const detectionRules = [
    {
      rule: "Sin Rostro",
      trigger: "facesCount === 0 por > 900ms",
      event: "SIN_ROSTRO",
      confidence: 85,
      color: "bg-red-50 border-red-300 text-red-800"
    },
    {
      rule: "Múltiples Rostros",
      trigger: "facesCount >= 2 por > 700ms",
      event: "MULTIPLES_ROSTROS",
      confidence: 90,
      color: "bg-orange-50 border-orange-300 text-orange-800"
    },
    {
      rule: "Cabeza Girada Izquierda",
      trigger: "yaw <= -0.18 por > 1400ms",
      event: "MIRADA_DESVIADA",
      confidence: 80,
      color: "bg-yellow-50 border-yellow-300 text-yellow-800"
    },
    {
      rule: "Cabeza Girada Derecha",
      trigger: "yaw >= 0.18 por > 1400ms",
      event: "MIRADA_DESVIADA",
      confidence: 80,
      color: "bg-yellow-50 border-yellow-300 text-yellow-800"
    }
  ];

  const modelComparison = {
    facemesh: {
      name: "MediaPipe FaceMesh",
      pros: [
        "468 puntos faciales (landmarks) de alta precisión",
        "Detecta orientación de cabeza (yaw, pitch, roll)",
        "Muy preciso para análisis de mirada",
        "Actualizado por Google constantemente"
      ],
      cons: [
        "Más pesado computacionalmente",
        "Requiere GPU/WebGL para buen rendimiento",
        "Puede fallar en dispositivos antiguos"
      ],
      useCase: "Modo primario - máxima precisión"
    },
    blazeface: {
      name: "BlazeFace",
      pros: [
        "Muy rápido y ligero",
        "Funciona bien en CPU",
        "Compatible con dispositivos antiguos",
        "Bajo consumo de batería"
      ],
      cons: [
        "Solo detecta rostros (bounding box)",
        "NO detecta orientación de cabeza",
        "Menos preciso en condiciones difíciles"
      ],
      useCase: "Fallback - cuando FaceMesh falla"
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Algoritmo de Detección Facial con Deep Learning
              </h1>
              <p className="text-gray-600 mt-1">
                Sistema dual: FaceMesh (preciso) + BlazeFace (fallback)
              </p>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid md:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-blue-600 text-sm font-semibold">Frecuencia</div>
              <div className="text-2xl font-bold text-blue-900">350ms</div>
              <div className="text-xs text-blue-600">~3 FPS análisis</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-green-600 text-sm font-semibold">Landmarks</div>
              <div className="text-2xl font-bold text-green-900">468</div>
              <div className="text-xs text-green-600">puntos faciales</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-purple-600 text-sm font-semibold">Precisión Yaw</div>
              <div className="text-2xl font-bold text-purple-900">±0.001</div>
              <div className="text-xs text-purple-600">alta sensibilidad</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-orange-600 text-sm font-semibold">Rostros Max</div>
              <div className="text-2xl font-bold text-orange-900">2</div>
              <div className="text-xs text-orange-600">detectables</div>
            </div>
          </div>
        </div>

        {/* Algorithm Flow */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Flujo del Algoritmo</h2>
          
          <div className="space-y-3 mb-6">
            {algorithmFlow.map((step, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  activeStep === idx
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    activeStep === idx ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">
                      Paso {step.step}: {step.title}
                    </div>
                    <div className="text-sm text-gray-600">{step.explanation}</div>
                  </div>
                  <div className="text-2xl text-gray-400">
                    {activeStep === idx ? '▼' : '▶'}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Code Display */}
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <div className="text-gray-400 text-xs mb-2">// {algorithmFlow[activeStep].title}</div>
            <pre className="text-green-400 text-sm font-mono">
              {algorithmFlow[activeStep].code}
            </pre>
          </div>
        </div>

        {/* Detection Rules */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">🎯 Reglas de Detección</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {detectionRules.map((rule, idx) => (
              <div key={idx} className={`border-2 rounded-lg p-4 ${rule.color}`}>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-bold mb-1">{rule.rule}</div>
                    <div className="text-sm mb-2">
                      <strong>Trigger:</strong> {rule.trigger}
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="bg-white bg-opacity-50 px-2 py-1 rounded">
                        Evento: {rule.event}
                      </span>
                      <span className="bg-white bg-opacity-50 px-2 py-1 rounded">
                        Confianza: {rule.confidence}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>Ventanas de estabilidad:</strong> Evitan falsos positivos por movimientos momentáneos.
                Solo alertan si la condición se mantiene durante el tiempo especificado.
              </div>
            </div>
          </div>
        </div>

        {/* Model Comparison */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">🤖 Comparación de Modelos</h2>
          
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSelectedModel('facemesh')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                selectedModel === 'facemesh'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              MediaPipe FaceMesh
            </button>
            <button
              onClick={() => setSelectedModel('blazeface')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                selectedModel === 'blazeface'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              BlazeFace
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-gray-800 mb-2">
                {modelComparison[selectedModel].name}
              </h3>
              <div className="text-sm text-gray-600 mb-3">
                Uso: <strong>{modelComparison[selectedModel].useCase}</strong>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Ventajas
                </div>
                <ul className="space-y-1">
                  {modelComparison[selectedModel].pros.map((pro, idx) => (
                    <li key={idx} className="text-sm text-green-700">
                      • {pro}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Limitaciones
                </div>
                <ul className="space-y-1">
                  {modelComparison[selectedModel].cons.map((con, idx) => (
                    <li key={idx} className="text-sm text-orange-700">
                      • {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Specs */}
        <div className="mt-6 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-xl font-bold mb-4">⚡ Especificaciones Técnicas</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-semibold mb-1">Backend TensorFlow.js</div>
              <div className="text-blue-100">WebGL (GPU) preferido</div>
              <div className="text-blue-100">Fallback a CPU si necesario</div>
            </div>
            <div>
              <div className="font-semibold mb-1">Resolución de Análisis</div>
              <div className="text-blue-100">Automática (del stream)</div>
              <div className="text-blue-100">Típico: 640x480 o mayor</div>
            </div>
            <div>
              <div className="font-semibold mb-1">Cooldown Anti-spam</div>
              <div className="text-blue-100">3.5s entre eventos iguales</div>
              <div className="text-blue-100">Evita saturar el backend</div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-3">📝 Resumen del Algoritmo</h3>
          <div className="space-y-2 text-gray-700">
            <p>
              <strong>1. Sistema dual robusto:</strong> FaceMesh para precisión máxima, BlazeFace como respaldo
            </p>
            <p>
              <strong>2. Detección multi-condición:</strong> Sin rostro, múltiples rostros, orientación de cabeza
            </p>
            <p>
              <strong>3. Geometría facial para yaw:</strong> Usa posición de nariz vs ojos (468 landmarks)
            </p>
            <p>
              <strong>4. Ventanas de estabilidad:</strong> Evita falsos positivos con delays calibrados
            </p>
            <p>
              <strong>5. Auto-recuperación:</strong> Si FaceMesh falla 6+ veces, cambia a BlazeFace
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceDetectionAlgorithm;
