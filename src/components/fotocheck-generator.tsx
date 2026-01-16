'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  FileImage,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Trash2,
  Eye,
  FileSpreadsheet,
  Users,
  Settings2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Crop,
  RotateCcw,
  Check,
  Move,
} from 'lucide-react';
import JSZip from 'jszip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PersonaFotocheck,
  FotocheckConfig,
  FotocheckStep,
  DEFAULT_FOTOCHECK_CONFIG,
} from '@/types/fotocheck';
import {
  renderFotocheck,
  renderPreviewToCanvas,
  sanitizarNombreArchivo,
} from '@/components/fotocheck-canvas-renderer';
import { cn } from '@/lib/utils';

export default function FotocheckGenerator() {
  // Estado principal
  const [step, setStep] = useState<FotocheckStep>('plantilla');
  const [plantillaBase64, setPlantillaBase64] = useState<string | null>(null);
  const [config, setConfig] = useState<FotocheckConfig>(DEFAULT_FOTOCHECK_CONFIG);
  const [personas, setPersonas] = useState<PersonaFotocheck[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Estado para recorte de imagen
  const [cropMode, setCropMode] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [cropDragging, setCropDragging] = useState<string | null>(null);
  const [cropCursor, setCropCursor] = useState('default');
  const cropPreviewRef = useRef<HTMLCanvasElement>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Estado para drag & drop en configuración
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<string | null>(null); // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [cursorStyle, setCursorStyle] = useState('default');
  const [showGuides, setShowGuides] = useState(true); // Mostrar guías de alineación
  const configCanvasRef = useRef<HTMLCanvasElement>(null);

  // Modo de carga de datos
  const [modoCargar, setModoCargar] = useState<'excel' | 'formulario'>('excel');

  // Formulario individual
  const [formPersona, setFormPersona] = useState<Omit<PersonaFotocheck, 'id'>>({
    apellidos: '',
    nombres: '',
    dni: '',
    cargo: '',
    sede: '',
    fotoBase64: '',
  });

  // Referencias
  const plantillaInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const fotosInputRef = useRef<HTMLInputElement>(null);
  const fotoIndividualInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);

  // Actualizar preview cuando cambia la configuración o plantilla
  useEffect(() => {
    if (previewCanvasRef.current && plantillaBase64) {
      const personaActual = personas[previewIndex] || null;
      renderPreviewToCanvas(previewCanvasRef.current, plantillaBase64, personaActual, config);
    }
  }, [plantillaBase64, config, personas, previewIndex, step]);

  // Dibujar canvas de configuración interactivo
  const drawConfigCanvas = useCallback(() => {
    const canvas = configCanvasRef.current;
    if (!canvas || !plantillaBase64) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const scaleX = canvas.width / config.width;
      const scaleY = canvas.height / config.height;

      // Dibujar guías de alineación
      if (showGuides) {
        ctx.save();
        ctx.setLineDash([5, 5]);

        // Líneas centrales (más prominentes)
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)'; // Rojo
        ctx.lineWidth = 1.5;
        // Línea vertical central
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
        // Línea horizontal central
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        // Líneas de tercios (más sutiles)
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'; // Azul
        ctx.lineWidth = 1;
        // Tercios verticales
        ctx.beginPath();
        ctx.moveTo(canvas.width / 3, 0);
        ctx.lineTo(canvas.width / 3, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo((canvas.width / 3) * 2, 0);
        ctx.lineTo((canvas.width / 3) * 2, canvas.height);
        ctx.stroke();
        // Tercios horizontales
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 3);
        ctx.lineTo(canvas.width, canvas.height / 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, (canvas.height / 3) * 2);
        ctx.lineTo(canvas.width, (canvas.height / 3) * 2);
        ctx.stroke();

        // Márgenes (10% desde los bordes)
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)'; // Verde
        ctx.lineWidth = 1;
        const marginX = canvas.width * 0.1;
        const marginY = canvas.height * 0.1;
        // Margen izquierdo
        ctx.beginPath();
        ctx.moveTo(marginX, 0);
        ctx.lineTo(marginX, canvas.height);
        ctx.stroke();
        // Margen derecho
        ctx.beginPath();
        ctx.moveTo(canvas.width - marginX, 0);
        ctx.lineTo(canvas.width - marginX, canvas.height);
        ctx.stroke();
        // Margen superior
        ctx.beginPath();
        ctx.moveTo(0, marginY);
        ctx.lineTo(canvas.width, marginY);
        ctx.stroke();
        // Margen inferior
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - marginY);
        ctx.lineTo(canvas.width, canvas.height - marginY);
        ctx.stroke();

        ctx.restore();
      }

      // Dibujar área de foto
      const fotoX = config.fotoX * scaleX;
      const fotoY = config.fotoY * scaleY;
      const fotoW = config.fotoWidth * scaleX;
      const fotoH = config.fotoHeight * scaleY;
      const scaledRadius = (config.fotoBorderRadius || 0) * Math.min(scaleX, scaleY);

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

      ctx.fillStyle = selectedElement === 'foto' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(200, 200, 200, 0.5)';
      ctx.strokeStyle = selectedElement === 'foto' ? '#3b82f6' : '#666';
      ctx.lineWidth = 2;

      if (config.fotoCircular) {
        // Foto circular
        const centerX = fotoX + fotoW / 2;
        const centerY = fotoY + fotoH / 2;
        const radius = Math.min(fotoW, fotoH) / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (scaledRadius > 0) {
        // Foto con esquinas redondeadas
        drawRoundedRect(fotoX, fotoY, fotoW, fotoH, scaledRadius);
        ctx.fill();
        ctx.stroke();
      } else {
        // Foto rectangular
        ctx.fillRect(fotoX, fotoY, fotoW, fotoH);
        ctx.strokeRect(fotoX, fotoY, fotoW, fotoH);
      }

      ctx.fillStyle = '#333';
      ctx.font = `${14 * scaleY}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('FOTO', fotoX + fotoW / 2, fotoY + fotoH / 2 + 5);

      // Dibujar handles de redimensionamiento si la foto está seleccionada
      if (selectedElement === 'foto') {
        const handleSize = 8;
        ctx.fillStyle = '#3b82f6';

        // Esquinas
        ctx.fillRect(fotoX - handleSize/2, fotoY - handleSize/2, handleSize, handleSize); // NW
        ctx.fillRect(fotoX + fotoW - handleSize/2, fotoY - handleSize/2, handleSize, handleSize); // NE
        ctx.fillRect(fotoX - handleSize/2, fotoY + fotoH - handleSize/2, handleSize, handleSize); // SW
        ctx.fillRect(fotoX + fotoW - handleSize/2, fotoY + fotoH - handleSize/2, handleSize, handleSize); // SE

        // Bordes medios
        ctx.fillRect(fotoX + fotoW/2 - handleSize/2, fotoY - handleSize/2, handleSize, handleSize); // N
        ctx.fillRect(fotoX + fotoW/2 - handleSize/2, fotoY + fotoH - handleSize/2, handleSize, handleSize); // S
        ctx.fillRect(fotoX - handleSize/2, fotoY + fotoH/2 - handleSize/2, handleSize, handleSize); // W
        ctx.fillRect(fotoX + fotoW - handleSize/2, fotoY + fotoH/2 - handleSize/2, handleSize, handleSize); // E
      }

      // Función para dividir texto en líneas
      const wrapTextConfig = (text: string, maxWidth: number): string[] => {
        if (ctx.measureText(text).width <= maxWidth) {
          return [text];
        }
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(testLine).width <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
      };

      // Margen escalado
      const marginScaled = 10 * scaleX;

      // Función para calcular ancho máximo
      const getMaxWidthConfig = (xScaled: number) => {
        const distToLeft = xScaled - marginScaled;
        const distToRight = canvas.width - xScaled - marginScaled;
        return Math.min(distToLeft, distToRight) * 2;
      };

      // Función para dibujar elemento de texto con wrap
      const drawTextElement = (id: string, x: number, y: number, fontSize: number, text: string, color: string, font: string, bold: boolean) => {
        const scaledX = x * scaleX;
        const scaledY = y * scaleY;
        const scaledFontSize = fontSize * scaleY;

        ctx.font = `${bold ? 'bold ' : ''}${scaledFontSize}px ${font || config.fontFamily}`;
        ctx.textAlign = 'center';

        const maxWidth = getMaxWidthConfig(scaledX);
        const lines = wrapTextConfig(text, maxWidth);
        const lineHeight = scaledFontSize * 1.05;
        const totalHeight = (lines.length - 1) * lineHeight;

        // Calcular dimensiones del área de texto
        let maxLineWidth = 0;
        for (const line of lines) {
          const w = ctx.measureText(line).width;
          if (w > maxLineWidth) maxLineWidth = w;
        }

        const rectX = scaledX - maxLineWidth / 2 - 5;
        const rectY = scaledY - totalHeight / 2 - scaledFontSize;
        const rectW = maxLineWidth + 10;
        const rectH = totalHeight + scaledFontSize + 5;

        // Fondo del elemento si está seleccionado
        if (selectedElement === id) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
          ctx.fillRect(rectX, rectY, rectW, rectH);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.strokeRect(rectX, rectY, rectW, rectH);
        }

        // Dibujar cada línea centrada
        ctx.fillStyle = color || config.textColor;
        let startY = scaledY - totalHeight / 2;
        for (const line of lines) {
          ctx.fillText(line, scaledX, startY);
          startY += lineHeight;
        }
      };

      drawTextElement('apellidos', config.apellidosX, config.apellidosY, config.apellidosFontSize, 'RODRIGUEZ FERNANDEZ', config.apellidosColor, config.apellidosFont, config.apellidosBold);
      drawTextElement('nombres', config.nombresX, config.nombresY, config.nombresFontSize, 'María Alexandra', config.nombresColor, config.nombresFont, config.nombresBold);
      drawTextElement('dni', config.dniX, config.dniY, config.dniFontSize, 'DNI: 72584931', config.dniColor, config.dniFont, config.dniBold);
      drawTextElement('cargo', config.cargoX, config.cargoY, config.cargoFontSize, 'Asistente Administrativo', config.cargoColor, config.cargoFont, config.cargoBold);
      drawTextElement('sede', config.sedeX, config.sedeY, config.sedeFontSize, 'Arequipa - Sede Regional Sur', config.sedeColor, config.sedeFont, config.sedeBold);
    };
    img.src = plantillaBase64;
  }, [plantillaBase64, config, selectedElement, showGuides]);

  useEffect(() => {
    if (step === 'configuracion') {
      drawConfigCanvas();
    }
  }, [step, drawConfigCanvas]);

  // Dibujar canvas de recorte
  const drawCropCanvas = useCallback(() => {
    const canvas = cropPreviewRef.current;
    if (!canvas || !originalImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Guardar dimensiones originales
      setImageDimensions({ width: img.width, height: img.height });

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dibujar imagen completa con overlay oscuro
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Overlay oscuro sobre toda la imagen
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calcular área de recorte en píxeles del canvas
      const cropX = (cropArea.x / 100) * canvas.width;
      const cropY = (cropArea.y / 100) * canvas.height;
      const cropW = (cropArea.width / 100) * canvas.width;
      const cropH = (cropArea.height / 100) * canvas.height;

      // Dibujar área clara (el recorte)
      ctx.save();
      ctx.beginPath();
      ctx.rect(cropX, cropY, cropW, cropH);
      ctx.clip();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Borde del área de recorte
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(cropX, cropY, cropW, cropH);
      ctx.setLineDash([]);

      // Dibujar handles de redimensionamiento
      const handleSize = 10;
      ctx.fillStyle = '#3b82f6';

      // Esquinas
      ctx.fillRect(cropX - handleSize/2, cropY - handleSize/2, handleSize, handleSize);
      ctx.fillRect(cropX + cropW - handleSize/2, cropY - handleSize/2, handleSize, handleSize);
      ctx.fillRect(cropX - handleSize/2, cropY + cropH - handleSize/2, handleSize, handleSize);
      ctx.fillRect(cropX + cropW - handleSize/2, cropY + cropH - handleSize/2, handleSize, handleSize);

      // Bordes medios
      ctx.fillRect(cropX + cropW/2 - handleSize/2, cropY - handleSize/2, handleSize, handleSize);
      ctx.fillRect(cropX + cropW/2 - handleSize/2, cropY + cropH - handleSize/2, handleSize, handleSize);
      ctx.fillRect(cropX - handleSize/2, cropY + cropH/2 - handleSize/2, handleSize, handleSize);
      ctx.fillRect(cropX + cropW - handleSize/2, cropY + cropH/2 - handleSize/2, handleSize, handleSize);
    };
    img.src = originalImage;
  }, [originalImage, cropArea]);

  useEffect(() => {
    if (cropMode && originalImage) {
      drawCropCanvas();
    }
  }, [cropMode, originalImage, drawCropCanvas]);

  // Detectar handle de recorte
  const getCropHandle = useCallback((x: number, y: number, canvasWidth: number, canvasHeight: number): string | null => {
    const cropX = (cropArea.x / 100) * canvasWidth;
    const cropY = (cropArea.y / 100) * canvasHeight;
    const cropW = (cropArea.width / 100) * canvasWidth;
    const cropH = (cropArea.height / 100) * canvasHeight;
    const handleSize = 15;

    // Esquinas
    if (Math.abs(x - cropX) < handleSize && Math.abs(y - cropY) < handleSize) return 'nw';
    if (Math.abs(x - (cropX + cropW)) < handleSize && Math.abs(y - cropY) < handleSize) return 'ne';
    if (Math.abs(x - cropX) < handleSize && Math.abs(y - (cropY + cropH)) < handleSize) return 'sw';
    if (Math.abs(x - (cropX + cropW)) < handleSize && Math.abs(y - (cropY + cropH)) < handleSize) return 'se';

    // Bordes
    if (Math.abs(x - (cropX + cropW/2)) < handleSize && Math.abs(y - cropY) < handleSize) return 'n';
    if (Math.abs(x - (cropX + cropW/2)) < handleSize && Math.abs(y - (cropY + cropH)) < handleSize) return 's';
    if (Math.abs(x - cropX) < handleSize && Math.abs(y - (cropY + cropH/2)) < handleSize) return 'w';
    if (Math.abs(x - (cropX + cropW)) < handleSize && Math.abs(y - (cropY + cropH/2)) < handleSize) return 'e';

    // Dentro del área (para mover)
    if (x >= cropX && x <= cropX + cropW && y >= cropY && y <= cropY + cropH) return 'move';

    return null;
  }, [cropArea]);

  // Manejadores de mouse para recorte
  const handleCropMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = cropPreviewRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const handle = getCropHandle(x, y, canvas.width, canvas.height);
    if (handle) {
      setCropDragging(handle);
    }
  }, [getCropHandle]);

  const handleCropMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = cropPreviewRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Actualizar cursor
    if (!cropDragging) {
      const handle = getCropHandle(x, y, canvas.width, canvas.height);
      if (handle) {
        const cursors: Record<string, string> = {
          'nw': 'nw-resize', 'ne': 'ne-resize', 'sw': 'sw-resize', 'se': 'se-resize',
          'n': 'n-resize', 's': 's-resize', 'e': 'e-resize', 'w': 'w-resize',
          'move': 'move'
        };
        setCropCursor(cursors[handle] || 'default');
      } else {
        setCropCursor('default');
      }
    }

    if (!cropDragging) return;

    const newX = (x / canvas.width) * 100;
    const newY = (y / canvas.height) * 100;
    const minSize = 5;

    setCropArea((c) => {
      let { x: cx, y: cy, width: cw, height: ch } = c;

      switch (cropDragging) {
        case 'move':
          const deltaX = newX - (cx + cw / 2);
          const deltaY = newY - (cy + ch / 2);
          cx = Math.max(0, Math.min(100 - cw, cx + deltaX));
          cy = Math.max(0, Math.min(100 - ch, cy + deltaY));
          break;
        case 'se':
          cw = Math.max(minSize, Math.min(100 - cx, newX - cx));
          ch = Math.max(minSize, Math.min(100 - cy, newY - cy));
          break;
        case 'sw':
          const newWidthSW = cx + cw - newX;
          if (newWidthSW >= minSize && newX >= 0) {
            cw = newWidthSW;
            cx = newX;
          }
          ch = Math.max(minSize, Math.min(100 - cy, newY - cy));
          break;
        case 'ne':
          cw = Math.max(minSize, Math.min(100 - cx, newX - cx));
          const newHeightNE = cy + ch - newY;
          if (newHeightNE >= minSize && newY >= 0) {
            ch = newHeightNE;
            cy = newY;
          }
          break;
        case 'nw':
          const newWidthNW = cx + cw - newX;
          const newHeightNW = cy + ch - newY;
          if (newWidthNW >= minSize && newX >= 0) {
            cw = newWidthNW;
            cx = newX;
          }
          if (newHeightNW >= minSize && newY >= 0) {
            ch = newHeightNW;
            cy = newY;
          }
          break;
        case 'n':
          const newHeightN = cy + ch - newY;
          if (newHeightN >= minSize && newY >= 0) {
            ch = newHeightN;
            cy = newY;
          }
          break;
        case 's':
          ch = Math.max(minSize, Math.min(100 - cy, newY - cy));
          break;
        case 'e':
          cw = Math.max(minSize, Math.min(100 - cx, newX - cx));
          break;
        case 'w':
          const newWidthW = cx + cw - newX;
          if (newWidthW >= minSize && newX >= 0) {
            cw = newWidthW;
            cx = newX;
          }
          break;
      }

      return { x: cx, y: cy, width: cw, height: ch };
    });
  }, [cropDragging, getCropHandle]);

  const handleCropMouseUp = useCallback(() => {
    setCropDragging(null);
  }, []);

  // Función auxiliar para detectar handle de resize
  const getResizeHandle = useCallback((x: number, y: number, scaleX: number, scaleY: number): string | null => {
    const fotoX = config.fotoX * scaleX;
    const fotoY = config.fotoY * scaleY;
    const fotoW = config.fotoWidth * scaleX;
    const fotoH = config.fotoHeight * scaleY;
    const handleSize = 12; // Área de detección

    // Esquinas
    if (Math.abs(x - fotoX) < handleSize && Math.abs(y - fotoY) < handleSize) return 'nw';
    if (Math.abs(x - (fotoX + fotoW)) < handleSize && Math.abs(y - fotoY) < handleSize) return 'ne';
    if (Math.abs(x - fotoX) < handleSize && Math.abs(y - (fotoY + fotoH)) < handleSize) return 'sw';
    if (Math.abs(x - (fotoX + fotoW)) < handleSize && Math.abs(y - (fotoY + fotoH)) < handleSize) return 'se';

    // Bordes medios
    if (Math.abs(x - (fotoX + fotoW/2)) < handleSize && Math.abs(y - fotoY) < handleSize) return 'n';
    if (Math.abs(x - (fotoX + fotoW/2)) < handleSize && Math.abs(y - (fotoY + fotoH)) < handleSize) return 's';
    if (Math.abs(x - fotoX) < handleSize && Math.abs(y - (fotoY + fotoH/2)) < handleSize) return 'w';
    if (Math.abs(x - (fotoX + fotoW)) < handleSize && Math.abs(y - (fotoY + fotoH/2)) < handleSize) return 'e';

    return null;
  }, [config.fotoX, config.fotoY, config.fotoWidth, config.fotoHeight]);

  // Manejadores de mouse para drag & drop
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = configCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const scaleX = canvas.width / config.width;
    const scaleY = canvas.height / config.height;

    // Primero verificar si estamos sobre un handle de resize (solo si foto está seleccionada)
    if (selectedElement === 'foto') {
      const handle = getResizeHandle(x, y, scaleX, scaleY);
      if (handle) {
        setResizing(handle);
        return;
      }
    }

    // Verificar si se hizo clic en la foto
    const fotoX = config.fotoX * scaleX;
    const fotoY = config.fotoY * scaleY;
    const fotoW = config.fotoWidth * scaleX;
    const fotoH = config.fotoHeight * scaleY;

    if (x >= fotoX && x <= fotoX + fotoW && y >= fotoY && y <= fotoY + fotoH) {
      setDragging('foto');
      setSelectedElement('foto');
      return;
    }

    // Verificar textos (área aproximada)
    const checkTextHit = (id: string, textX: number, textY: number, fontSize: number) => {
      const scaledX = textX * scaleX;
      const scaledY = textY * scaleY;
      const hitArea = fontSize * scaleY * 2;
      if (Math.abs(x - scaledX) < hitArea && Math.abs(y - scaledY) < hitArea / 2) {
        setDragging(id);
        setSelectedElement(id);
        return true;
      }
      return false;
    };

    if (checkTextHit('apellidos', config.apellidosX, config.apellidosY, config.apellidosFontSize)) return;
    if (checkTextHit('nombres', config.nombresX, config.nombresY, config.nombresFontSize)) return;
    if (checkTextHit('dni', config.dniX, config.dniY, config.dniFontSize)) return;
    if (checkTextHit('cargo', config.cargoX, config.cargoY, config.cargoFontSize)) return;
    if (checkTextHit('sede', config.sedeX, config.sedeY, config.sedeFontSize)) return;

    setSelectedElement(null);
  }, [config, selectedElement, getResizeHandle]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = configCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const scaleX = canvas.width / config.width;
    const scaleY = canvas.height / config.height;

    // Actualizar cursor según posición
    if (!dragging && !resizing) {
      if (selectedElement === 'foto') {
        const handle = getResizeHandle(x, y, scaleX, scaleY);
        if (handle) {
          const cursors: Record<string, string> = {
            'nw': 'nw-resize', 'ne': 'ne-resize', 'sw': 'sw-resize', 'se': 'se-resize',
            'n': 'n-resize', 's': 's-resize', 'e': 'e-resize', 'w': 'w-resize'
          };
          setCursorStyle(cursors[handle] || 'default');
        } else {
          setCursorStyle('grab');
        }
      } else {
        setCursorStyle('grab');
      }
    }

    // Si estamos redimensionando
    if (resizing) {
      const newX = Math.round(x / scaleX);
      const newY = Math.round(y / scaleY);

      setConfig((c) => {
        let { fotoX, fotoY, fotoWidth, fotoHeight } = c;
        const minSize = 30;

        switch (resizing) {
          case 'se':
            fotoWidth = Math.max(minSize, newX - fotoX);
            fotoHeight = Math.max(minSize, newY - fotoY);
            break;
          case 'sw':
            fotoWidth = Math.max(minSize, fotoX + fotoWidth - newX);
            fotoHeight = Math.max(minSize, newY - fotoY);
            fotoX = Math.min(newX, fotoX + fotoWidth - minSize);
            break;
          case 'ne':
            fotoWidth = Math.max(minSize, newX - fotoX);
            fotoHeight = Math.max(minSize, fotoY + fotoHeight - newY);
            fotoY = Math.min(newY, fotoY + fotoHeight - minSize);
            break;
          case 'nw':
            fotoWidth = Math.max(minSize, fotoX + fotoWidth - newX);
            fotoHeight = Math.max(minSize, fotoY + fotoHeight - newY);
            fotoX = Math.min(newX, fotoX + fotoWidth - minSize);
            fotoY = Math.min(newY, fotoY + fotoHeight - minSize);
            break;
          case 'n':
            fotoHeight = Math.max(minSize, fotoY + fotoHeight - newY);
            fotoY = Math.min(newY, fotoY + fotoHeight - minSize);
            break;
          case 's':
            fotoHeight = Math.max(minSize, newY - fotoY);
            break;
          case 'e':
            fotoWidth = Math.max(minSize, newX - fotoX);
            break;
          case 'w':
            fotoWidth = Math.max(minSize, fotoX + fotoWidth - newX);
            fotoX = Math.min(newX, fotoX + fotoWidth - minSize);
            break;
        }

        return { ...c, fotoX, fotoY, fotoWidth, fotoHeight };
      });
      return;
    }

    // Si estamos arrastrando
    if (!dragging) return;

    const newX = Math.round(x / scaleX);
    const newY = Math.round(y / scaleY);

    setConfig((c) => {
      switch (dragging) {
        case 'foto':
          return { ...c, fotoX: Math.max(0, newX - c.fotoWidth / 2), fotoY: Math.max(0, newY - c.fotoHeight / 2) };
        case 'apellidos':
          return { ...c, apellidosX: newX, apellidosY: newY };
        case 'nombres':
          return { ...c, nombresX: newX, nombresY: newY };
        case 'dni':
          return { ...c, dniX: newX, dniY: newY };
        case 'cargo':
          return { ...c, cargoX: newX, cargoY: newY };
        case 'sede':
          return { ...c, sedeX: newX, sedeY: newY };
        default:
          return c;
      }
    });
  }, [dragging, resizing, config.width, config.height, selectedElement, getResizeHandle]);

  const handleCanvasMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  // Manejar carga de plantilla
  const handlePlantillaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen (PNG, JPG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe exceder 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPlantillaBase64(base64);
      setOriginalImage(base64);
      setCropMode(false);
      setCropArea({ x: 0, y: 0, width: 100, height: 100 });
      setError(null);

      // Obtener dimensiones de la imagen y ajustar configuración
      const img = new Image();
      img.onload = () => {
        // Calcular factores de escala basados en las dimensiones por defecto
        const defaultW = DEFAULT_FOTOCHECK_CONFIG.width;
        const defaultH = DEFAULT_FOTOCHECK_CONFIG.height;
        const scaleX = img.width / defaultW;
        const scaleY = img.height / defaultH;

        // Ajustar todas las posiciones proporcionalmente
        setConfig({
          ...DEFAULT_FOTOCHECK_CONFIG,
          width: img.width,
          height: img.height,
          // Escalar posiciones de foto
          fotoX: Math.round(DEFAULT_FOTOCHECK_CONFIG.fotoX * scaleX),
          fotoY: Math.round(DEFAULT_FOTOCHECK_CONFIG.fotoY * scaleY),
          fotoWidth: Math.round(DEFAULT_FOTOCHECK_CONFIG.fotoWidth * scaleX),
          fotoHeight: Math.round(DEFAULT_FOTOCHECK_CONFIG.fotoHeight * scaleY),
          // Escalar posiciones de textos
          apellidosX: Math.round(DEFAULT_FOTOCHECK_CONFIG.apellidosX * scaleX),
          apellidosY: Math.round(DEFAULT_FOTOCHECK_CONFIG.apellidosY * scaleY),
          apellidosFontSize: Math.round(DEFAULT_FOTOCHECK_CONFIG.apellidosFontSize * Math.min(scaleX, scaleY)),
          nombresX: Math.round(DEFAULT_FOTOCHECK_CONFIG.nombresX * scaleX),
          nombresY: Math.round(DEFAULT_FOTOCHECK_CONFIG.nombresY * scaleY),
          nombresFontSize: Math.round(DEFAULT_FOTOCHECK_CONFIG.nombresFontSize * Math.min(scaleX, scaleY)),
          dniX: Math.round(DEFAULT_FOTOCHECK_CONFIG.dniX * scaleX),
          dniY: Math.round(DEFAULT_FOTOCHECK_CONFIG.dniY * scaleY),
          dniFontSize: Math.round(DEFAULT_FOTOCHECK_CONFIG.dniFontSize * Math.min(scaleX, scaleY)),
          cargoX: Math.round(DEFAULT_FOTOCHECK_CONFIG.cargoX * scaleX),
          cargoY: Math.round(DEFAULT_FOTOCHECK_CONFIG.cargoY * scaleY),
          cargoFontSize: Math.round(DEFAULT_FOTOCHECK_CONFIG.cargoFontSize * Math.min(scaleX, scaleY)),
          sedeX: Math.round(DEFAULT_FOTOCHECK_CONFIG.sedeX * scaleX),
          sedeY: Math.round(DEFAULT_FOTOCHECK_CONFIG.sedeY * scaleY),
          sedeFontSize: Math.round(DEFAULT_FOTOCHECK_CONFIG.sedeFontSize * Math.min(scaleX, scaleY)),
        });
        // También guardar dimensiones para el canvas de recorte
        setImageDimensions({ width: img.width, height: img.height });
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  }, []);

  // Aplicar recorte de imagen
  const aplicarRecorte = useCallback(async () => {
    if (!originalImage) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Calcular área de recorte en píxeles
      const cropX = (cropArea.x / 100) * img.width;
      const cropY = (cropArea.y / 100) * img.height;
      const cropW = (cropArea.width / 100) * img.width;
      const cropH = (cropArea.height / 100) * img.height;

      canvas.width = cropW;
      canvas.height = cropH;

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const croppedBase64 = canvas.toDataURL('image/png');
      setPlantillaBase64(croppedBase64);

      // Ajustar posiciones de todos los elementos al nuevo tamaño
      // Los elementos deben reposicionarse relativo al área recortada
      setConfig((prev) => {
        const scaleX = cropW / prev.width;
        const scaleY = cropH / prev.height;

        return {
          ...prev,
          width: cropW,
          height: cropH,
          // Ajustar posición de la foto
          fotoX: Math.max(10, (prev.fotoX - cropX) * scaleX),
          fotoY: Math.max(10, (prev.fotoY - cropY) * scaleY),
          fotoWidth: prev.fotoWidth * scaleX,
          fotoHeight: prev.fotoHeight * scaleY,
          // Ajustar posición de textos
          apellidosX: Math.min(cropW - 20, Math.max(20, (prev.apellidosX - cropX))),
          apellidosY: Math.min(cropH - 20, Math.max(40, (prev.apellidosY - cropY))),
          apellidosFontSize: Math.max(12, prev.apellidosFontSize * scaleY),
          nombresX: Math.min(cropW - 20, Math.max(20, (prev.nombresX - cropX))),
          nombresY: Math.min(cropH - 20, Math.max(60, (prev.nombresY - cropY))),
          nombresFontSize: Math.max(10, prev.nombresFontSize * scaleY),
          dniX: Math.min(cropW - 20, Math.max(20, (prev.dniX - cropX))),
          dniY: Math.min(cropH - 20, Math.max(80, (prev.dniY - cropY))),
          dniFontSize: Math.max(10, prev.dniFontSize * scaleY),
          cargoX: Math.min(cropW - 20, Math.max(20, (prev.cargoX - cropX))),
          cargoY: Math.min(cropH - 20, Math.max(100, (prev.cargoY - cropY))),
          cargoFontSize: Math.max(10, prev.cargoFontSize * scaleY),
          sedeX: Math.min(cropW - 20, Math.max(20, (prev.sedeX - cropX))),
          sedeY: Math.min(cropH - 20, Math.max(120, (prev.sedeY - cropY))),
          sedeFontSize: Math.max(10, prev.sedeFontSize * scaleY),
        };
      });

      setImageDimensions({ width: cropW, height: cropH });
      setCropMode(false);
    };
    img.src = originalImage;
  }, [originalImage, cropArea]);

  // Restaurar imagen original
  const restaurarImagen = useCallback(() => {
    if (originalImage) {
      setPlantillaBase64(originalImage);
      setCropArea({ x: 0, y: 0, width: 100, height: 100 });
      const img = new Image();
      img.onload = () => {
        // Restaurar configuración por defecto con las dimensiones de la imagen
        setConfig({
          ...DEFAULT_FOTOCHECK_CONFIG,
          width: img.width,
          height: img.height,
        });
        setImageDimensions({ width: img.width, height: img.height });
      };
      img.src = originalImage;
    }
    setCropMode(false);
  }, [originalImage]);

  // Manejar carga de Excel
  const handleExcelChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.xls', '.xlsx'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(ext)) {
      setError('Solo se permiten archivos Excel (.xls, .xlsx)');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const nuevasPersonas: PersonaFotocheck[] = data.map((row, index) => ({
        id: `persona-${Date.now()}-${index}`,
        apellidos: String(row['APELLIDOS'] || row['apellidos'] || '').trim(),
        nombres: String(row['NOMBRES'] || row['nombres'] || '').trim(),
        dni: String(row['DNI'] || row['dni'] || row['DOCUMENTO'] || '').trim(),
        cargo: String(row['CARGO'] || row['cargo'] || '').trim(),
        sede: String(row['SEDE'] || row['sede'] || row['LUGAR'] || row['lugar'] || '').trim(),
        fotoBase64: '',
        fotoNombre: String(row['FOTO'] || row['foto'] || '').trim(),
      }));

      // Filtrar filas vacías
      const personasValidas = nuevasPersonas.filter(
        (p) => p.apellidos || p.nombres || p.dni
      );

      setPersonas(personasValidas);
      setPreviewIndex(0);
    } catch (err) {
      console.error('Error procesando Excel:', err);
      setError('Error al procesar el archivo Excel');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Manejar carga de fotos (ZIP o múltiples archivos)
  const handleFotosChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsProcessing(true);
      setError(null);

      try {
        const fotosMap = new Map<string, string>();

        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            const base64 = await fileToBase64(file);
            const nombreSinExt = file.name.replace(/\.[^.]+$/, '').toLowerCase();
            fotosMap.set(nombreSinExt, base64);
          } else if (file.name.endsWith('.zip')) {
            // Extraer imágenes del ZIP
            const zip = await JSZip.loadAsync(file);
            for (const [filename, zipFile] of Object.entries(zip.files)) {
              if (!zipFile.dir && /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) {
                const blob = await zipFile.async('blob');
                const base64 = await blobToBase64(blob);
                const nombreSinExt = filename
                  .split('/')
                  .pop()!
                  .replace(/\.[^.]+$/, '')
                  .toLowerCase();
                fotosMap.set(nombreSinExt, base64);
              }
            }
          }
        }

        // Asignar fotos a personas
        setPersonas((prev) =>
          prev.map((persona) => {
            const nombreBuscar = persona.fotoNombre?.replace(/\.[^.]+$/, '').toLowerCase() || '';
            const fotoEncontrada = fotosMap.get(nombreBuscar);
            if (fotoEncontrada) {
              return { ...persona, fotoBase64: fotoEncontrada };
            }
            // Buscar por apellido o nombre
            for (const [key, value] of fotosMap) {
              if (
                key.includes(persona.apellidos.toLowerCase().split(' ')[0]) ||
                key.includes(persona.nombres.toLowerCase().split(' ')[0])
              ) {
                return { ...persona, fotoBase64: value };
              }
            }
            return persona;
          })
        );
      } catch (err) {
        console.error('Error procesando fotos:', err);
        setError('Error al procesar las fotos');
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  // Manejar foto individual para formulario
  const handleFotoIndividualChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        setError('Solo se permiten archivos de imagen');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setFormPersona((prev) => ({
          ...prev,
          fotoBase64: event.target?.result as string,
        }));
      };
      reader.readAsDataURL(file);
    },
    []
  );

  // Agregar persona desde formulario
  const agregarPersona = useCallback(() => {
    if (!formPersona.apellidos.trim() || !formPersona.nombres.trim()) {
      setError('Apellidos y Nombres son requeridos');
      return;
    }

    const nuevaPersona: PersonaFotocheck = {
      ...formPersona,
      id: `persona-${Date.now()}`,
    };

    setPersonas((prev) => [...prev, nuevaPersona]);
    setFormPersona({
      apellidos: '',
      nombres: '',
      dni: '',
      cargo: '',
      sede: '',
      fotoBase64: '',
    });
    setError(null);
  }, [formPersona]);

  // Eliminar persona
  const eliminarPersona = useCallback((id: string) => {
    setPersonas((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Asignar foto a persona específica
  const asignarFotoAPersona = useCallback((personaId: string, fotoBase64: string) => {
    setPersonas((prev) =>
      prev.map((p) => (p.id === personaId ? { ...p, fotoBase64 } : p))
    );
  }, []);

  // Generar y descargar ZIP
  const generarZip = useCallback(async () => {
    if (!plantillaBase64 || personas.length === 0) {
      setError('Necesitas una plantilla y al menos una persona');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const zip = new JSZip();

      for (let i = 0; i < personas.length; i++) {
        const persona = personas[i];
        const blob = await renderFotocheck(plantillaBase64, persona, config);
        const nombreArchivo = sanitizarNombreArchivo(persona.apellidos, persona.nombres);
        zip.file(`${nombreArchivo}.png`, blob);

        setProgress(Math.round(((i + 1) / personas.length) * 100));
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // Descargar
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fotochecks_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error generando ZIP:', err);
      setError('Error al generar los fotochecks');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [plantillaBase64, personas, config]);

  // Descargar plantilla Excel de ejemplo
  const descargarPlantillaExcel = useCallback(async () => {
    const XLSX = await import('xlsx');

    const data = [
      {
        APELLIDOS: 'PEREZ GARCIA',
        NOMBRES: 'Juan Carlos',
        DNI: '12345678',
        CARGO: 'Ingeniero de Sistemas',
        SEDE: 'Lima - Sede Central',
        FOTO: 'juan_perez.jpg',
      },
      {
        APELLIDOS: 'RODRIGUEZ LOPEZ',
        NOMBRES: 'Maria Elena',
        DNI: '87654321',
        CARGO: 'Contadora General',
        SEDE: 'Arequipa - Sucursal',
        FOTO: 'maria_rodriguez.png',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personas');
    XLSX.writeFile(wb, 'plantilla_fotochecks.xlsx');
  }, []);

  // Helpers
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Pasos del wizard
  const steps = [
    { id: 'plantilla', label: 'Plantilla', icon: FileImage },
    { id: 'configuracion', label: 'Configurar', icon: Settings2 },
    { id: 'datos', label: 'Datos', icon: Users },
    { id: 'preview', label: 'Generar', icon: Download },
  ];

  const canGoNext = () => {
    switch (step) {
      case 'plantilla':
        return !!plantillaBase64;
      case 'configuracion':
        return true;
      case 'datos':
        return personas.length > 0;
      case 'preview':
        return false;
      default:
        return false;
    }
  };

  const goNext = () => {
    const stepOrder: FotocheckStep[] = ['plantilla', 'configuracion', 'datos', 'preview'];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex < stepOrder.length - 1) {
      setStep(stepOrder[currentIndex + 1]);
    }
  };

  const goBack = () => {
    const stepOrder: FotocheckStep[] = ['plantilla', 'configuracion', 'datos', 'preview'];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Indicador de pasos */}
      <div className="flex items-center justify-center">
        <div className="flex items-center space-x-2">
          {steps.map((s, index) => (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => setStep(s.id as FotocheckStep)}
                className={cn(
                  'flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors',
                  step === s.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                <s.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {index < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* Contenido del paso actual */}
      <Card>
        <CardContent className="p-6">
          {/* PASO 1: Plantilla */}
          {step === 'plantilla' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2 dark:text-white">
                  Subir Plantilla del Fotocheck
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Sube una imagen que servirá como fondo para los fotochecks
                </p>
              </div>

              {!plantillaBase64 ? (
                <div
                  onClick={() => plantillaInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-gray-300 dark:border-gray-600"
                >
                  <input
                    ref={plantillaInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePlantillaChange}
                    className="hidden"
                  />
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Haz clic o arrastra una imagen aquí
                  </p>
                  <p className="text-sm text-gray-500 mt-2">PNG, JPG hasta 5MB</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Barra de herramientas */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 dark:text-green-400 font-medium">
                        Plantilla cargada
                      </span>
                      <span className="text-sm text-gray-500">
                        ({Math.round(config.width)} x {Math.round(config.height)} px)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCropMode(!cropMode)}
                        className={cn(
                          'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors',
                          cropMode
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        )}
                      >
                        <Crop className="w-4 h-4" />
                        Recortar
                      </button>
                      {originalImage && originalImage !== plantillaBase64 && (
                        <button
                          onClick={restaurarImagen}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Restaurar
                        </button>
                      )}
                      <button
                        onClick={() => plantillaInputRef.current?.click()}
                        className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                      >
                        Cambiar imagen
                      </button>
                      <input
                        ref={plantillaInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePlantillaChange}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Modo recorte interactivo */}
                  {cropMode && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-2">
                        <Move className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm text-blue-700 dark:text-blue-300">
                          Arrastra los bordes o esquinas para ajustar el recorte. Arrastra dentro del área para moverla.
                        </span>
                      </div>

                      {/* Canvas interactivo de recorte */}
                      <div className="flex justify-center">
                        <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-lg">
                          <canvas
                            ref={cropPreviewRef}
                            width={imageDimensions.width > 0 ? Math.min(700, imageDimensions.width) : 700}
                            height={imageDimensions.width > 0 ? Math.min(700, imageDimensions.width) * (imageDimensions.height / imageDimensions.width) : 450}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '450px',
                              cursor: cropDragging ? 'grabbing' : cropCursor,
                            }}
                            onMouseDown={handleCropMouseDown}
                            onMouseMove={handleCropMouseMove}
                            onMouseUp={handleCropMouseUp}
                            onMouseLeave={handleCropMouseUp}
                          />
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={aplicarRecorte}
                          className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          <Check className="w-4 h-4" />
                          Aplicar recorte
                        </button>
                        <button
                          onClick={() => setCropMode(false)}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                          Cancelar
                        </button>
                      </div>

                      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                        El área clara será el fotocheck final
                      </p>
                    </div>
                  )}

                  {/* Preview de la plantilla (cuando no está en modo recorte) */}
                  {!cropMode && (
                    <div className="flex justify-center">
                      <div className="relative border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-lg">
                        <img
                          src={plantillaBase64}
                          alt="Plantilla"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '400px',
                            width: 'auto',
                            height: 'auto',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {!cropMode && (
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                      Esta imagen se usará como fondo para todos los fotochecks
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PASO 2: Configuración */}
          {step === 'configuracion' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2 dark:text-white">
                  Configurar Posiciones
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Arrastra los elementos con el mouse para posicionarlos
                </p>
              </div>

              {/* Instrucciones y controles */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Move className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Haz clic y arrastra los elementos para posicionarlos
                  </span>
                </div>
                <button
                  onClick={() => setShowGuides(!showGuides)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    showGuides
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  )}
                >
                  {showGuides ? 'Ocultar guías' : 'Mostrar guías'}
                </button>
              </div>

              {/* Leyenda de guías */}
              {showGuides && (
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-0.5 bg-red-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Centro</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-0.5 bg-blue-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Tercios</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-0.5 bg-green-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Márgenes (10%)</span>
                  </div>
                </div>
              )}

              {/* Canvas interactivo */}
              <div className="flex justify-center">
                <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-lg">
                  <canvas
                    ref={configCanvasRef}
                    width={config.width > 0 ? Math.min(700, config.width) : 700}
                    height={config.width > 0 ? Math.min(700, config.width) * (config.height / config.width) : 450}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '450px',
                      cursor: dragging ? 'grabbing' : resizing ? `${resizing}-resize` : cursorStyle,
                    }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                  />
                </div>
              </div>

              {/* Panel de propiedades del elemento seleccionado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Propiedades del elemento seleccionado */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
                  <h4 className="font-medium text-sm dark:text-white">
                    {selectedElement ? `Elemento: ${selectedElement.toUpperCase()}` : 'Selecciona un elemento'}
                  </h4>

                  {selectedElement === 'foto' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Ancho</label>
                          <input
                            type="number"
                            value={config.fotoWidth}
                            onChange={(e) => setConfig((c) => ({ ...c, fotoWidth: Number(e.target.value) }))}
                            className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Alto</label>
                          <input
                            type="number"
                            value={config.fotoHeight}
                            onChange={(e) => setConfig((c) => ({ ...c, fotoHeight: Number(e.target.value) }))}
                            className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Esquinas redondeadas (px)</label>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={config.fotoBorderRadius}
                          onChange={(e) => setConfig((c) => ({ ...c, fotoBorderRadius: Number(e.target.value), fotoCircular: false }))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>0</span>
                          <span>{config.fotoBorderRadius}px</span>
                          <span>50</span>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={config.fotoCircular}
                          onChange={(e) => setConfig((c) => ({ ...c, fotoCircular: e.target.checked, fotoBorderRadius: 0 }))}
                          className="rounded"
                        />
                        <span className="dark:text-gray-300">Recorte circular</span>
                      </label>
                    </div>
                  )}

                  {selectedElement && selectedElement !== 'foto' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Tamaño</label>
                          <input
                            type="number"
                            min="8"
                            max="72"
                            value={
                              selectedElement === 'apellidos' ? config.apellidosFontSize :
                              selectedElement === 'nombres' ? config.nombresFontSize :
                              selectedElement === 'dni' ? config.dniFontSize :
                              selectedElement === 'cargo' ? config.cargoFontSize :
                              config.sedeFontSize
                            }
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setConfig((c) => {
                                switch (selectedElement) {
                                  case 'apellidos': return { ...c, apellidosFontSize: val };
                                  case 'nombres': return { ...c, nombresFontSize: val };
                                  case 'dni': return { ...c, dniFontSize: val };
                                  case 'cargo': return { ...c, cargoFontSize: val };
                                  case 'sede': return { ...c, sedeFontSize: val };
                                  default: return c;
                                }
                              });
                            }}
                            className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Color</label>
                          <input
                            type="color"
                            value={
                              selectedElement === 'apellidos' ? config.apellidosColor :
                              selectedElement === 'nombres' ? config.nombresColor :
                              selectedElement === 'dni' ? config.dniColor :
                              selectedElement === 'cargo' ? config.cargoColor :
                              config.sedeColor
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              setConfig((c) => {
                                switch (selectedElement) {
                                  case 'apellidos': return { ...c, apellidosColor: val };
                                  case 'nombres': return { ...c, nombresColor: val };
                                  case 'dni': return { ...c, dniColor: val };
                                  case 'cargo': return { ...c, cargoColor: val };
                                  case 'sede': return { ...c, sedeColor: val };
                                  default: return c;
                                }
                              });
                            }}
                            className="w-full h-8 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Fuente</label>
                        <select
                          value={
                            selectedElement === 'apellidos' ? config.apellidosFont :
                            selectedElement === 'nombres' ? config.nombresFont :
                            selectedElement === 'dni' ? config.dniFont :
                            selectedElement === 'cargo' ? config.cargoFont :
                            config.sedeFont
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            setConfig((c) => {
                              switch (selectedElement) {
                                case 'apellidos': return { ...c, apellidosFont: val };
                                case 'nombres': return { ...c, nombresFont: val };
                                case 'dni': return { ...c, dniFont: val };
                                case 'cargo': return { ...c, cargoFont: val };
                                case 'sede': return { ...c, sedeFont: val };
                                default: return c;
                              }
                            });
                          }}
                          className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value="Arial">Arial</option>
                          <option value="FuturaBT Bold">FuturaBT Bold</option>
                          <option value="Lato Black">Lato Black</option>
                          <option value="Helvetica">Helvetica</option>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Georgia">Georgia</option>
                          <option value="Verdana">Verdana</option>
                          <option value="Trebuchet MS">Trebuchet MS</option>
                          <option value="Impact">Impact</option>
                          <option value="Comic Sans MS">Comic Sans MS</option>
                          <option value="Courier New">Courier New</option>
                          <option value="Lucida Console">Lucida Console</option>
                          <option value="Tahoma">Tahoma</option>
                          <option value="Palatino Linotype">Palatino Linotype</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={
                            selectedElement === 'apellidos' ? config.apellidosBold :
                            selectedElement === 'nombres' ? config.nombresBold :
                            selectedElement === 'dni' ? config.dniBold :
                            selectedElement === 'cargo' ? config.cargoBold :
                            config.sedeBold
                          }
                          onChange={(e) => {
                            const val = e.target.checked;
                            setConfig((c) => {
                              switch (selectedElement) {
                                case 'apellidos': return { ...c, apellidosBold: val };
                                case 'nombres': return { ...c, nombresBold: val };
                                case 'dni': return { ...c, dniBold: val };
                                case 'cargo': return { ...c, cargoBold: val };
                                case 'sede': return { ...c, sedeBold: val };
                                default: return c;
                              }
                            });
                          }}
                          className="rounded"
                        />
                        <span className="dark:text-gray-300">Negrita</span>
                      </label>
                    </div>
                  )}

                  {!selectedElement && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Haz clic en un elemento del canvas para editarlo
                    </p>
                  )}
                </div>

                {/* Estilos generales */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
                  <h4 className="font-medium text-sm dark:text-white">Estilos generales</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Color texto</label>
                      <input
                        type="color"
                        value={config.textColor}
                        onChange={(e) => setConfig((c) => ({ ...c, textColor: e.target.value }))}
                        className="w-full h-8 rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Alineación</label>
                      <select
                        value={config.textAlign}
                        onChange={(e) => setConfig((c) => ({ ...c, textAlign: e.target.value as CanvasTextAlign }))}
                        className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option value="left">Izquierda</option>
                        <option value="center">Centro</option>
                        <option value="right">Derecha</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel de posiciones actuales */}
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h4 className="font-medium text-sm dark:text-white mb-2">Posiciones actuales (debug)</h4>
                <div className="text-xs font-mono text-gray-700 dark:text-gray-300 space-y-1">
                  <p>Canvas: {Math.round(config.width)} x {Math.round(config.height)}</p>
                  <p>Foto: X={Math.round(config.fotoX)}, Y={Math.round(config.fotoY)}, W={Math.round(config.fotoWidth)}, H={Math.round(config.fotoHeight)}, BorderRadius={config.fotoBorderRadius}px</p>
                  <p className="flex items-center gap-1 flex-wrap">
                    Apellidos: X={Math.round(config.apellidosX)}, Y={Math.round(config.apellidosY)}, Size={Math.round(config.apellidosFontSize)},
                    <span className="inline-block w-3 h-3 rounded border" style={{ backgroundColor: config.apellidosColor }}></span>
                    {config.apellidosColor}, {config.apellidosFont}, {config.apellidosBold ? 'Bold' : 'Normal'}
                  </p>
                  <p className="flex items-center gap-1 flex-wrap">
                    Nombres: X={Math.round(config.nombresX)}, Y={Math.round(config.nombresY)}, Size={Math.round(config.nombresFontSize)},
                    <span className="inline-block w-3 h-3 rounded border" style={{ backgroundColor: config.nombresColor }}></span>
                    {config.nombresColor}, {config.nombresFont}, {config.nombresBold ? 'Bold' : 'Normal'}
                  </p>
                  <p className="flex items-center gap-1 flex-wrap">
                    DNI: X={Math.round(config.dniX)}, Y={Math.round(config.dniY)}, Size={Math.round(config.dniFontSize)},
                    <span className="inline-block w-3 h-3 rounded border" style={{ backgroundColor: config.dniColor }}></span>
                    {config.dniColor}, {config.dniFont}, {config.dniBold ? 'Bold' : 'Normal'}
                  </p>
                  <p className="flex items-center gap-1 flex-wrap">
                    Cargo: X={Math.round(config.cargoX)}, Y={Math.round(config.cargoY)}, Size={Math.round(config.cargoFontSize)},
                    <span className="inline-block w-3 h-3 rounded border" style={{ backgroundColor: config.cargoColor }}></span>
                    {config.cargoColor}, {config.cargoFont}, {config.cargoBold ? 'Bold' : 'Normal'}
                  </p>
                  <p className="flex items-center gap-1 flex-wrap">
                    Sede: X={Math.round(config.sedeX)}, Y={Math.round(config.sedeY)}, Size={Math.round(config.sedeFontSize)},
                    <span className="inline-block w-3 h-3 rounded border" style={{ backgroundColor: config.sedeColor }}></span>
                    {config.sedeColor}, {config.sedeFont}, {config.sedeBold ? 'Bold' : 'Normal'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: Datos */}
          {step === 'datos' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2 dark:text-white">Cargar Datos</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Carga los datos de las personas desde Excel o agrégalos manualmente
                </p>
              </div>

              {/* Selector de modo */}
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setModoCargar('excel')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                    modoCargar === 'excel'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  )}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Carga Masiva (Excel)
                </button>
                <button
                  onClick={() => setModoCargar('formulario')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                    modoCargar === 'formulario'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  )}
                >
                  <Users className="w-4 h-4" />
                  Formulario Individual
                </button>
              </div>

              {modoCargar === 'excel' && (
                <div className="space-y-4">
                  {/* Botón descargar plantilla */}
                  <button
                    onClick={descargarPlantillaExcel}
                    className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Descargar plantilla Excel de ejemplo
                  </button>

                  {/* Carga Excel */}
                  <div
                    onClick={() => excelInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-gray-300 dark:border-gray-600"
                  >
                    <input
                      ref={excelInputRef}
                      type="file"
                      accept=".xls,.xlsx"
                      onChange={handleExcelChange}
                      className="hidden"
                    />
                    <FileSpreadsheet className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Subir archivo Excel con datos
                    </p>
                    <p className="text-xs text-gray-500">
                      Columnas: APELLIDOS, NOMBRES, DNI, CARGO, SEDE, FOTO
                    </p>
                  </div>

                  {/* Carga de fotos */}
                  {personas.length > 0 && (
                    <div
                      onClick={() => fotosInputRef.current?.click()}
                      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 border-gray-300 dark:border-gray-600"
                    >
                      <input
                        ref={fotosInputRef}
                        type="file"
                        accept="image/*,.zip"
                        multiple
                        onChange={handleFotosChange}
                        className="hidden"
                      />
                      <ImageIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-600 dark:text-gray-400">
                        Subir fotos (imágenes o ZIP)
                      </p>
                      <p className="text-xs text-gray-500">
                        Los nombres de archivo deben coincidir con la columna FOTO
                      </p>
                    </div>
                  )}
                </div>
              )}

              {modoCargar === 'formulario' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                      Apellidos *
                    </label>
                    <input
                      type="text"
                      value={formPersona.apellidos}
                      onChange={(e) =>
                        setFormPersona((p) => ({ ...p, apellidos: e.target.value }))
                      }
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="PEREZ GARCIA"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                      Nombres *
                    </label>
                    <input
                      type="text"
                      value={formPersona.nombres}
                      onChange={(e) =>
                        setFormPersona((p) => ({ ...p, nombres: e.target.value }))
                      }
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Juan Carlos"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                      DNI
                    </label>
                    <input
                      type="text"
                      value={formPersona.dni}
                      onChange={(e) =>
                        setFormPersona((p) => ({ ...p, dni: e.target.value }))
                      }
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                      Cargo
                    </label>
                    <input
                      type="text"
                      value={formPersona.cargo}
                      onChange={(e) =>
                        setFormPersona((p) => ({ ...p, cargo: e.target.value }))
                      }
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Ingeniero de Sistemas"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                      Sede
                    </label>
                    <input
                      type="text"
                      value={formPersona.sede}
                      onChange={(e) =>
                        setFormPersona((p) => ({ ...p, sede: e.target.value }))
                      }
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Lima - Sede Central"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                      Foto
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fotoIndividualInputRef.current?.click()}
                        className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-500"
                      >
                        Seleccionar
                      </button>
                      <input
                        ref={fotoIndividualInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFotoIndividualChange}
                        className="hidden"
                      />
                      {formPersona.fotoBase64 && (
                        <img
                          src={formPersona.fotoBase64}
                          alt="Preview"
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <button
                      onClick={agregarPersona}
                      className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar Persona
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de personas */}
              {personas.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium dark:text-white">
                    Personas cargadas: {personas.length}
                  </h3>
                  <div className="max-h-64 overflow-y-auto border rounded-lg dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left dark:text-gray-300">#</th>
                          <th className="px-3 py-2 text-left dark:text-gray-300">Foto</th>
                          <th className="px-3 py-2 text-left dark:text-gray-300">Apellidos</th>
                          <th className="px-3 py-2 text-left dark:text-gray-300">Nombres</th>
                          <th className="px-3 py-2 text-left dark:text-gray-300">DNI</th>
                          <th className="px-3 py-2 text-left dark:text-gray-300">Cargo</th>
                          <th className="px-3 py-2 text-left dark:text-gray-300">Sede</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {personas.map((p, i) => (
                          <tr
                            key={p.id}
                            className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <td className="px-3 py-2 dark:text-gray-300">{i + 1}</td>
                            <td className="px-3 py-2">
                              {p.fotoBase64 ? (
                                <img
                                  src={p.fotoBase64}
                                  alt=""
                                  className="w-8 h-8 object-cover rounded"
                                />
                              ) : (
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                          asignarFotoAPersona(p.id, ev.target?.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                  <span className="text-xs text-primary-600 hover:underline">
                                    + Foto
                                  </span>
                                </label>
                              )}
                            </td>
                            <td className="px-3 py-2 dark:text-gray-300">{p.apellidos}</td>
                            <td className="px-3 py-2 dark:text-gray-300">{p.nombres}</td>
                            <td className="px-3 py-2 dark:text-gray-300">{p.dni}</td>
                            <td className="px-3 py-2 dark:text-gray-300">{p.cargo}</td>
                            <td className="px-3 py-2 dark:text-gray-300">{p.sede}</td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => eliminarPersona(p.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 4: Preview y Generar */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2 dark:text-white">
                  Vista Previa y Generación
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Revisa los fotochecks antes de generar el archivo ZIP
                </p>
              </div>

              {/* Preview navegable */}
              <div className="flex flex-col items-center space-y-4">
                <div className="border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-lg">
                  <canvas
                    ref={previewCanvasRef}
                    width={config.width > 0 ? Math.min(600, config.width) : 600}
                    height={config.width > 0 ? Math.min(600, config.width) * (config.height / config.width) : 380}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '450px',
                      width: 'auto',
                      height: 'auto',
                    }}
                  />
                </div>

                {/* Navegación */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                    disabled={previewIndex === 0}
                    className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5 dark:text-gray-300" />
                  </button>
                  <span className="dark:text-gray-300">
                    {previewIndex + 1} de {personas.length}
                  </span>
                  <button
                    onClick={() =>
                      setPreviewIndex((i) => Math.min(personas.length - 1, i + 1))
                    }
                    disabled={previewIndex === personas.length - 1}
                    className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 disabled:opacity-50"
                  >
                    <ChevronRight className="w-5 h-5 dark:text-gray-300" />
                  </button>
                </div>

                {/* Info persona actual */}
                {personas[previewIndex] && (
                  <div className="text-center text-sm dark:text-gray-300">
                    <p className="font-medium">
                      {personas[previewIndex].apellidos} {personas[previewIndex].nombres}
                    </p>
                    <p className="text-gray-500">{personas[previewIndex].cargo}</p>
                  </div>
                )}
              </div>

              {/* Resumen */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-medium mb-2 dark:text-white">Resumen</h3>
                <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                  <li>Total fotochecks a generar: {personas.length}</li>
                  <li>Formato de salida: PNG</li>
                  <li>
                    Archivo: fotochecks_{new Date().toISOString().split('T')[0]}.zip
                  </li>
                </ul>
              </div>

              {/* Barra de progreso */}
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="dark:text-gray-300">Generando fotochecks...</span>
                    <span className="dark:text-gray-300">{progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Botón generar */}
              <button
                onClick={generarZip}
                disabled={isProcessing || personas.length === 0}
                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Generar y Descargar ZIP
                  </>
                )}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navegación entre pasos */}
      <div className="flex justify-between">
        <button
          onClick={goBack}
          disabled={step === 'plantilla'}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600 dark:text-white"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>
        {step !== 'preview' && (
          <button
            onClick={goNext}
            disabled={!canGoNext()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50 hover:bg-primary-700"
          >
            Siguiente
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

