'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { comprobantesApi } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Loader2,
  AlertTriangle,
  Percent,
} from 'lucide-react';

interface StatsChartsProps {
  companyId: string;
}

interface HistoricoData {
  historico: Array<{
    periodo: string;
    mes: string;
    ventas: number;
    compras: number;
    igvVentas: number;
    igvCompras: number;
    igvNeto: number;
    cantidadVentas: number;
    cantidadCompras: number;
  }>;
  totales: {
    ventas: number;
    compras: number;
    igvVentas: number;
    igvCompras: number;
    comprobantes: number;
  };
  promedios: {
    ventasMensual: number;
    comprasMensual: number;
    igvMensual: number;
    margenBruto: number;
  };
  tendencia: {
    ventas: number;
    compras: number;
  };
}

// Formatear números para tooltips
const formatTooltipValue = (value: number) => formatCurrency(value);

// Componente de Tooltip personalizado
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="font-medium text-gray-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function StatsCharts({ companyId }: StatsChartsProps) {
  const [data, setData] = useState<HistoricoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await comprobantesApi.getHistorico(companyId, 6);
        setData(result);
      } catch (err) {
        console.error('Error cargando datos históricos:', err);
        setError('Error al cargar los gráficos');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        {error}
      </div>
    );
  }

  if (!data || data.historico.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No hay datos suficientes para mostrar gráficos</p>
            <p className="text-sm mt-1">Registra comprobantes para ver las tendencias</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Indicadores de Tendencia */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Promedio Ventas</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(data.promedios.ventasMensual)}
                </p>
              </div>
              <div className={`flex items-center ${data.tendencia.ventas >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.tendencia.ventas >= 0 ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
                <span className="text-sm font-medium ml-1">
                  {Math.abs(data.tendencia.ventas).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Promedio Compras</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(data.promedios.comprasMensual)}
                </p>
              </div>
              <div className={`flex items-center ${data.tendencia.compras <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.tendencia.compras <= 0 ? (
                  <TrendingDown className="w-5 h-5" />
                ) : (
                  <TrendingUp className="w-5 h-5" />
                )}
                <span className="text-sm font-medium ml-1">
                  {Math.abs(data.tendencia.compras).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">IGV Promedio</p>
                <p className={`text-lg font-bold ${data.promedios.igvMensual >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {formatCurrency(Math.abs(data.promedios.igvMensual))}
                </p>
              </div>
              <div className="text-gray-400">
                <span className="text-xs">{data.promedios.igvMensual >= 0 ? 'A pagar' : 'A favor'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Margen Bruto</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {data.promedios.margenBruto.toFixed(1)}%
                </p>
              </div>
              <div className="text-primary-500">
                <Percent className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Barras: Ventas vs Compras */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Ventas vs Compras (Últimos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.historico} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis
                  dataKey="mes"
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <YAxis
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="ventas"
                  name="Ventas"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="compras"
                  name="Compras"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Área: IGV Neto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Evolución IGV (Débito - Crédito)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.historico} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis
                  dataKey="mes"
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <YAxis
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="igvVentas"
                  name="IGV Ventas"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="igvCompras"
                  name="IGV Compras"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                />
                <Line
                  type="monotone"
                  dataKey="igvNeto"
                  name="IGV Neto"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <strong>IGV Neto positivo:</strong> Debes pagar a SUNAT |{' '}
              <strong>IGV Neto negativo:</strong> Tienes saldo a favor
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Resumen del período */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen del Período (6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-xs text-green-600 dark:text-green-400">Total Ventas</p>
              <p className="text-lg font-bold text-green-700 dark:text-green-300">
                {formatCurrency(data.totales.ventas)}
              </p>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-blue-600 dark:text-blue-400">Total Compras</p>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                {formatCurrency(data.totales.compras)}
              </p>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-xs text-purple-600 dark:text-purple-400">IGV Ventas</p>
              <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                {formatCurrency(data.totales.igvVentas)}
              </p>
            </div>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">IGV Compras</p>
              <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                {formatCurrency(data.totales.igvCompras)}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400">Comprobantes</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {data.totales.comprobantes}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
