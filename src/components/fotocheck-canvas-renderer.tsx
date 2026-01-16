'use client';

import { PersonaFotocheck, FotocheckConfig } from '@/types/fotocheck';

// Cargar imagen desde base64 o URL
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Error al cargar imagen'));
    img.src = src;
  });
}

// Función para dividir texto en líneas que quepan en el ancho máximo
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  // Si el texto cabe en una línea, retornarlo directamente
  if (ctx.measureText(text).width <= maxWidth) {
    return [text];
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      // Si la palabra sola es más ancha que maxWidth, forzar salto
      if (!currentLine) {
        lines.push(word);
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// Función para dibujar texto con salto de línea centrado
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const lines = wrapText(ctx, text, maxWidth);

  // Calcular posición Y inicial para centrar verticalmente las líneas
  const totalHeight = (lines.length - 1) * lineHeight;
  let startY = y - totalHeight / 2;

  for (const line of lines) {
    ctx.fillText(line, x, startY);
    startY += lineHeight;
  }
}

// Renderizar un fotocheck en un canvas y retornar como Blob
export async function renderFotocheck(
  plantillaBase64: string,
  persona: PersonaFotocheck,
  config: FotocheckConfig
): Promise<Blob> {
  // Crear canvas
  const canvas = document.createElement('canvas');
  canvas.width = config.width;
  canvas.height = config.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('No se pudo crear contexto 2D');

  // 1. Cargar y dibujar plantilla de fondo
  const plantillaImg = await loadImage(plantillaBase64);
  ctx.drawImage(plantillaImg, 0, 0, config.width, config.height);

  // 2. Cargar y dibujar foto de la persona
  if (persona.fotoBase64) {
    const fotoImg = await loadImage(persona.fotoBase64);

    if (config.fotoCircular) {
      // Recorte circular
      ctx.save();
      ctx.beginPath();
      const centerX = config.fotoX + config.fotoWidth / 2;
      const centerY = config.fotoY + config.fotoHeight / 2;
      const radius = Math.min(config.fotoWidth, config.fotoHeight) / 2;
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(fotoImg, config.fotoX, config.fotoY, config.fotoWidth, config.fotoHeight);
      ctx.restore();
    } else if (config.fotoBorderRadius > 0) {
      // Esquinas redondeadas
      ctx.save();
      ctx.beginPath();
      const x = config.fotoX;
      const y = config.fotoY;
      const w = config.fotoWidth;
      const h = config.fotoHeight;
      const r = config.fotoBorderRadius;
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(fotoImg, config.fotoX, config.fotoY, config.fotoWidth, config.fotoHeight);
      ctx.restore();
    } else {
      // Rectangular
      ctx.drawImage(fotoImg, config.fotoX, config.fotoY, config.fotoWidth, config.fotoHeight);
    }
  }

  // 3. Configurar alineación de texto (siempre centrado)
  ctx.textAlign = 'center';

  // Margen desde los bordes (10px de cada lado)
  const margin = 10;

  // Función para calcular ancho máximo basado en la posición X del texto
  // Para texto centrado en X, puede extenderse hasta el borde más cercano
  const getMaxWidth = (x: number) => {
    const distToLeft = x - margin;
    const distToRight = config.width - x - margin;
    return Math.min(distToLeft, distToRight) * 2;
  };

  // 4. Dibujar Apellidos
  ctx.fillStyle = config.apellidosColor || config.textColor;
  ctx.font = `${config.apellidosBold ? 'bold ' : ''}${config.apellidosFontSize}px ${config.apellidosFont || config.fontFamily}`;
  const apellidosLineHeight = config.apellidosFontSize * 1.05;
  drawWrappedText(ctx, persona.apellidos.toUpperCase(), config.apellidosX, config.apellidosY, getMaxWidth(config.apellidosX), apellidosLineHeight);

  // 5. Dibujar Nombres
  ctx.fillStyle = config.nombresColor || config.textColor;
  ctx.font = `${config.nombresBold ? 'bold ' : ''}${config.nombresFontSize}px ${config.nombresFont || config.fontFamily}`;
  const nombresLineHeight = config.nombresFontSize * 1.05;
  drawWrappedText(ctx, persona.nombres, config.nombresX, config.nombresY, getMaxWidth(config.nombresX), nombresLineHeight);

  // 6. Dibujar DNI
  ctx.fillStyle = config.dniColor || config.textColor;
  ctx.font = `${config.dniBold ? 'bold ' : ''}${config.dniFontSize}px ${config.dniFont || config.fontFamily}`;
  ctx.fillText(`DNI: ${persona.dni}`, config.dniX, config.dniY);

  // 7. Dibujar Cargo
  ctx.fillStyle = config.cargoColor || config.textColor;
  ctx.font = `${config.cargoBold ? 'bold ' : ''}${config.cargoFontSize}px ${config.cargoFont || config.fontFamily}`;
  const cargoLineHeight = config.cargoFontSize * 1.05;
  drawWrappedText(ctx, persona.cargo, config.cargoX, config.cargoY, getMaxWidth(config.cargoX), cargoLineHeight);

  // 8. Dibujar Sede
  ctx.fillStyle = config.sedeColor || config.textColor;
  ctx.font = `${config.sedeBold ? 'bold ' : ''}${config.sedeFontSize}px ${config.sedeFont || config.fontFamily}`;
  const sedeLineHeight = config.sedeFontSize * 1.05;
  drawWrappedText(ctx, persona.sede, config.sedeX, config.sedeY, getMaxWidth(config.sedeX), sedeLineHeight);

  // 9. Exportar como PNG
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Error al generar imagen'));
      },
      'image/png',
      1.0
    );
  });
}

// Renderizar preview en un canvas existente
export async function renderPreviewToCanvas(
  canvasRef: HTMLCanvasElement,
  plantillaBase64: string | null,
  persona: PersonaFotocheck | null,
  config: FotocheckConfig
): Promise<void> {
  const ctx = canvasRef.getContext('2d');
  if (!ctx) return;

  // Limpiar canvas
  ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);

  // Fondo gris si no hay plantilla
  if (!plantillaBase64) {
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Sube una plantilla', canvasRef.width / 2, canvasRef.height / 2);
    return;
  }

  // Dibujar plantilla
  try {
    const plantillaImg = await loadImage(plantillaBase64);
    ctx.drawImage(plantillaImg, 0, 0, canvasRef.width, canvasRef.height);
  } catch {
    ctx.fillStyle = '#fee2e2';
    ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);
    ctx.fillStyle = '#dc2626';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Error cargando plantilla', canvasRef.width / 2, canvasRef.height / 2);
    return;
  }

  // Si hay persona, dibujar sus datos
  const personaDemo: PersonaFotocheck = persona || {
    id: 'demo',
    apellidos: 'RODRIGUEZ FERNANDEZ',
    nombres: 'María Alexandra',
    dni: '72584931',
    cargo: 'Asistente Administrativo',
    sede: 'Arequipa - Sede Regional Sur',
    fotoBase64: '',
  };

  // Escalar configuración al tamaño del canvas
  const scaleX = canvasRef.width / config.width;
  const scaleY = canvasRef.height / config.height;

  // Dibujar foto (placeholder si no hay)
  const fotoX = config.fotoX * scaleX;
  const fotoY = config.fotoY * scaleY;
  const fotoW = config.fotoWidth * scaleX;
  const fotoH = config.fotoHeight * scaleY;

  // Función para dibujar rectángulo con esquinas redondeadas
  const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const scaledRadius = (config.fotoBorderRadius || 0) * Math.min(scaleX, scaleY);

  if (personaDemo.fotoBase64) {
    try {
      const fotoImg = await loadImage(personaDemo.fotoBase64);
      if (config.fotoCircular) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(fotoX + fotoW / 2, fotoY + fotoH / 2, Math.min(fotoW, fotoH) / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(fotoImg, fotoX, fotoY, fotoW, fotoH);
        ctx.restore();
      } else if (scaledRadius > 0) {
        ctx.save();
        drawRoundedRect(fotoX, fotoY, fotoW, fotoH, scaledRadius);
        ctx.clip();
        ctx.drawImage(fotoImg, fotoX, fotoY, fotoW, fotoH);
        ctx.restore();
      } else {
        ctx.drawImage(fotoImg, fotoX, fotoY, fotoW, fotoH);
      }
    } catch {
      // Placeholder
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(fotoX, fotoY, fotoW, fotoH);
      ctx.fillStyle = '#9ca3af';
      ctx.font = `${12 * scaleX}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('FOTO', fotoX + fotoW / 2, fotoY + fotoH / 2);
    }
  } else {
    // Placeholder
    ctx.fillStyle = '#e5e7eb';
    if (scaledRadius > 0) {
      drawRoundedRect(fotoX, fotoY, fotoW, fotoH, scaledRadius);
      ctx.fill();
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillRect(fotoX, fotoY, fotoW, fotoH);
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2;
      ctx.strokeRect(fotoX, fotoY, fotoW, fotoH);
    }
    ctx.fillStyle = '#6b7280';
    ctx.font = `${14 * scaleX}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('FOTO', fotoX + fotoW / 2, fotoY + fotoH / 2);
  }

  // Dibujar textos escalados (siempre centrados)
  ctx.textAlign = 'center';

  // Margen escalado desde los bordes
  const marginScaled = 10 * scaleX;

  // Función para calcular ancho máximo basado en la posición X escalada
  const getMaxWidthScaled = (xScaled: number) => {
    const distToLeft = xScaled - marginScaled;
    const distToRight = canvasRef.width - xScaled - marginScaled;
    return Math.min(distToLeft, distToRight) * 2;
  };

  // Apellidos
  const apellidosXScaled = config.apellidosX * scaleX;
  ctx.fillStyle = config.apellidosColor || config.textColor;
  ctx.font = `${config.apellidosBold ? 'bold ' : ''}${config.apellidosFontSize * scaleY}px ${config.apellidosFont || config.fontFamily}`;
  const apellidosLineHeight = config.apellidosFontSize * scaleY * 1.05;
  drawWrappedText(ctx, personaDemo.apellidos.toUpperCase(), apellidosXScaled, config.apellidosY * scaleY, getMaxWidthScaled(apellidosXScaled), apellidosLineHeight);

  // Nombres
  const nombresXScaled = config.nombresX * scaleX;
  ctx.fillStyle = config.nombresColor || config.textColor;
  ctx.font = `${config.nombresBold ? 'bold ' : ''}${config.nombresFontSize * scaleY}px ${config.nombresFont || config.fontFamily}`;
  const nombresLineHeight = config.nombresFontSize * scaleY * 1.05;
  drawWrappedText(ctx, personaDemo.nombres, nombresXScaled, config.nombresY * scaleY, getMaxWidthScaled(nombresXScaled), nombresLineHeight);

  // DNI (no necesita wrap, es corto)
  ctx.fillStyle = config.dniColor || config.textColor;
  ctx.font = `${config.dniBold ? 'bold ' : ''}${config.dniFontSize * scaleY}px ${config.dniFont || config.fontFamily}`;
  ctx.fillText(`DNI: ${personaDemo.dni}`, config.dniX * scaleX, config.dniY * scaleY);

  // Cargo
  const cargoXScaled = config.cargoX * scaleX;
  ctx.fillStyle = config.cargoColor || config.textColor;
  ctx.font = `${config.cargoBold ? 'bold ' : ''}${config.cargoFontSize * scaleY}px ${config.cargoFont || config.fontFamily}`;
  const cargoLineHeight = config.cargoFontSize * scaleY * 1.05;
  drawWrappedText(ctx, personaDemo.cargo, cargoXScaled, config.cargoY * scaleY, getMaxWidthScaled(cargoXScaled), cargoLineHeight);

  // Sede
  const sedeXScaled = config.sedeX * scaleX;
  ctx.fillStyle = config.sedeColor || config.textColor;
  ctx.font = `${config.sedeBold ? 'bold ' : ''}${config.sedeFontSize * scaleY}px ${config.sedeFont || config.fontFamily}`;
  const sedeLineHeight = config.sedeFontSize * scaleY * 1.05;
  drawWrappedText(ctx, personaDemo.sede, sedeXScaled, config.sedeY * scaleY, getMaxWidthScaled(sedeXScaled), sedeLineHeight);
}

// Sanitizar nombre para archivo
export function sanitizarNombreArchivo(apellidos: string, nombres: string): string {
  const nombreCompleto = `${apellidos}_${nombres}`;
  return nombreCompleto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-zA-Z0-9\s]/g, '') // Solo alfanuméricos
    .replace(/\s+/g, '_') // Espacios a guiones bajos
    .toLowerCase()
    .substring(0, 50); // Limitar longitud
}
