# Gobierno, permisos y fallas

## Sistemas y permisos
Lectura de archivos de demostración dentro de datos/, mediante un identificador de escenario enumerado; escritura solo en una carpeta de corrida nueva. Conexión HTTPS a api.openai.com para enviar la solicitud y la observación. OPENAI_API_KEY se lee del entorno; no se conserva en solicitudes_api.json ni en el repositorio.

La API recibe exclusivamente los datos suministrados al caso. En uso real habría que autorizar su transmisión antes de incluir información de clientes, ventas, calendarios o correo. Estos ejemplos no contienen datos personales reales. store=false se solicita en la API; eso no se presenta como garantía general de retención cero del proveedor.

## Supervisión
Etiqueta de esta demostración: L2, entendida aquí como propuesta automática y aprobación humana antes de actuar. La descripción concreta es: el sistema lee y propone; responsable de compras revisa fuentes, cálculos y alertas, y firma la decisión en el sistema operativo correspondiente. La aplicación no ejecuta compras, reservas, envíos ni publicaciones. No se afirma que las corridas ya cuenten con una firma humana.

| Falla o riesgo | Consecuencia | Respuesta | Quién revisa |
|---|---|---|---|
| Falta un dato o no hay una opción válida | Propuesta incompleta | No inventar; explicitar el límite o devolver lista vacía | responsable de compras |
| El LLM altera un resultado de herramienta o una cita | Salida no confiable | validacion.json registra problemas; exit code 2; no ejecutar acción | responsable de compras |
| API o red falla | No hay resultado completo | Conservar el error y no simular éxito | Persona operadora |
| Instrucciones dentro de los datos | Intento de modificar comportamiento | Datos separados como observación; sin herramientas de navegación o acción | responsable de compras |
| Fuente incorrecta o desactualizada | Recomendación equivocada aunque el cálculo sea correcto | Revisar fuente antes de firmar | responsable de compras |
| Entrada o archivo demasiado grande | Memoria o contexto excesivos | Alcance actual: archivos pequeños previamente seleccionados; falta un límite de bytes en el lector | Persona operadora |

## Límites operativos
El presupuesto local limita las llamadas de una ejecución de preparación; no limita toda la cuenta de OpenAI ni coordina múltiples procesos concurrentes. La preparación se ejecutó en serie. No hay reintentos automáticos ni garantía de idempotencia ante un timeout. Una respuesta JSON válida no certifica veracidad. Para producción se requieren autenticación, controles de acceso a los archivos, observabilidad y validación de privacidad adicionales.
