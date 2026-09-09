# Comparación de fórmulas durante la construcción

La primera alternativa considerada fue max(0, demanda*(plazo+seguridad)-stock). La comprobación de requisitos mostró que omite pedidos entrantes y tamaño de bulto. No se presenta como un fallo descubierto en producción ni como una versión desplegada.

La fórmula completa descuenta entrantes y redondea al siguiente múltiplo de bulto. Los valores de proceso/comparacion_formulas.json fueron calculados en esta sesión; los tests de herramientas comprueban la alternativa elegida.

Se conservó la corrección antes de llamar al modelo: las cantidades se calculan con código y el modelo explica la propuesta. Si falta plazo, se requiere revisión; no se adivina un número.
