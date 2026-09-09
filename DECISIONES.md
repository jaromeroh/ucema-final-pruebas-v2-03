# Proceso documentado

Construcción docente en una sesión; no se atribuyen despliegues ni revisiones humanas inexistentes.

## Decisión 1: separar cálculo y explicación
La herramienta calcula cantidades con datos locales. El LLM explica la propuesta y el validador compara sku, quantity y action antes de aceptar el resultado. No se permite que el modelo decida una compra por sí solo.

## Decisión 2: revisar pedidos entrantes y bultos
proceso/comparacion_formulas.json conserva la comparación calculada entre una primera fórmula incompleta y la seleccionada. Los tests evitan un pedido duplicado cuando ya hay unidades entrantes y verifican el redondeo por bulto.

## Decisión 3: implementación JavaScript
Se eligió Node para ejecutar lectura local y llamadas HTTP sin dependencias. El contrato del CSV simple está documentado. La variante usa el mismo problema y las mismas entradas de negocio; no se afirma que un cambio de lenguaje mejore la calidad de las recomendaciones.

## Evidencia y limitaciones de la historia
Las pruebas guardadas muestran verificaciones realizadas sobre los archivos incluidos. El historial Git permite ubicar implementación y documentación. No se conserva una conversación completa con la IA ni una validación de campo empresarial. Las corridas preservan las instrucciones efectivamente enviadas al modelo; esas sí pueden auditarse literalmente.
