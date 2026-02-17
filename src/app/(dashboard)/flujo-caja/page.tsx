'use client';

import { useEffect, useState } from 'react';
import { useCompanyStore } from '@/store/company-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
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
  ReferenceLine,
} from 'recharts';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  Building2,
  DollarSign,
  CreditCard,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from 'lucide-react';

interface ProyeccionItem {
  periodo: string;
  mes: string;
  ventasProyectadas: number;
  comprasProyectadas: number;
  igvAPagar: number;
  rentaEstimada: number;
  flujoNeto: number;
  flujoAcumulado: number;
}

interface FlujoCajaData {
  proyeccion: ProyeccionItem[];
  resumen: {
    promedioVentasMensual: number;
    promedioComprasMensual: number;
    igvPromedioPagar: number;
    rentaPromedioMensual: number;
    flujoNetoPromedio: number;
    cuentasPorCobrar: number;
    cuentasPorPagar: number;
    ratioCobertura: number;
    totalIngresosProyectados: number;
    totalEgresosProyectados: number;
  };
  alertas: Array<{ tipo: 'warning' | 'danger' | 'info'; mensaje: string }>;
  mesesProyectados: number;
}

// Tooltip personalizado
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

export default function FlujoCajaPage() {
  const { selectedCompany } = useCompanyStore();
  const [data, setData] = useState<FlujoCajaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meses, setMeses] = useState(3);

  useEffect(() => {
    if (!selectedCompany) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiClient.get<FlujoCajaData>(
          `/api/companies/${selectedCompany.id}/flujo-caja?meses=${meses}`
        );
        setData(result);
      } catch (err) {
        console.error('Error cargando flujo de caja:', err);
        setError('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedCompany, meses]);

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Building2 className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Selecciona una empresa
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Necesitas seleccionar una empresa para ver el flujo de caja
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary-600" />
            Flujo de Caja
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Proyección de ingresos, egresos e impuestos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={meses === 3 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setMeses(3)}
          >
            3 meses
          </Button>
          <Button
            variant={meses === 6 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setMeses(6)}
          >
            6 meses
          </Button>
          <Button
            variant={meses === 12 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setMeses(12)}
          >
            12 meses
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Alertas */}
          {data.alertas.length > 0 && (
            <div className="space-y-2">
              {data.alertas.map((alerta, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg flex items-start gap-3 ${
                    alerta.tipo === 'danger'
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                      : alerta.tipo === 'warning'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
                        : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                  }`}
                >
                  {alerta.tipo === 'danger' ? (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : alerta.tipo === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <p>{alerta.mensaje}</p>
                </div>
              ))}
            </div>
          )}

          {/* Resumen Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Ingresos Proyectados</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(data.resumen.totalIngresosProyectados)}
                    </p>
                    <p className="text-xs text-gray-400">{meses} meses</p>
                  </div>
                  <ArrowUpRight className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Egresos Proyectados</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(data.resumen.totalEgresosProyectados)}
                    </p>
                    <p className="text-xs text-gray-400">Incluye impuestos</p>
                  </div>
                  <ArrowDownRight className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Flujo Neto Prom.</p>
                    <p className={`text-xl font-bold ${
                      data.resumen.flujoNetoPromedio >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(data.resumen.flujoNetoPromedio)}
                    </p>
                    <p className="text-xs text-gray-400">Por mes</p>
                  </div>
                  <DollarSign className={`w-8 h-8 ${
                    data.resumen.flujoNetoPromedio >= 0 ? 'text-green-500' : 'text-red-500'
                  }`} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Ratio Cobertura</p>
                    <p className={`text-xl font-bold ${
                      data.resumen.ratioCobertura >= 1
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {data.resumen.ratioCobertura.toFixed(2)}x
                    </p>
                    <p className="text-xs text-gray-400">Ingresos/Egresos</p>
                  </div>
                  <PiggyBank className={`w-8 h-8 ${
                    data.resumen.ratioCobertura >= 1 ? 'text-green-500' : 'text-red-500'
                  }`} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Flujo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                Proyección de Flujo de Caja
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.proyeccion} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                    <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                    <Bar dataKey="ventasProyectadas" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="comprasProyectadas" name="Compras" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="igvAPagar" name="IGV" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="rentaEstimada" name="Renta" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Flujo Acumulado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="w-5 h-5 text-primary-600" />
                Flujo Neto Acumulado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.proyeccion} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" label="Punto crítico" />
                    <Line
                      type="monotone"
                      dataKey="flujoNeto"
                      name="Flujo Neto"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="flujoAcumulado"
                      name="Acumulado"
                      stroke="#22c55e"
                      strokeWidth={3}
                      dot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Flujo Acumulado:</strong> Suma de flujos netos desde el inicio del período.
                  Si cruza la línea roja (0), indica necesidad de financiamiento.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cuentas por Cobrar/Pagar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="w-5 h-5 text-green-600" />
                  Cuentas por Cobrar (Estimado)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(data.resumen.cuentasPorCobrar)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Aproximado de ventas pendientes de cobro
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs text-green-700 dark:text-green-400">
                      <strong>Nota:</strong> Este es un estimado basado en el 30% de las ventas de los últimos 2 meses.
                      Para un seguimiento preciso, registra el estado de pago de cada comprobante.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="w-5 h-5 text-red-600" />
                  Cuentas por Pagar (Estimado)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(data.resumen.cuentasPorPagar)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Aproximado de compras pendientes de pago
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-xs text-red-700 dark:text-red-400">
                      <strong>Nota:</strong> Este es un estimado basado en el 40% de las compras de los últimos 2 meses.
                      Incluye potenciales obligaciones con proveedores.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla Detallada */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-primary-600" />
                Detalle por Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Período</th>
                      <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Ingresos</th>
                      <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Compras</th>
                      <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">IGV</th>
                      <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Renta</th>
                      <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Flujo Neto</th>
                      <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.proyeccion.map((item) => (
                      <tr key={item.periodo} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-2 font-medium text-gray-900 dark:text-white">{item.mes}</td>
                        <td className="py-3 px-2 text-right text-green-600 dark:text-green-400">
                          {formatCurrency(item.ventasProyectadas)}
                        </td>
                        <td className="py-3 px-2 text-right text-blue-600 dark:text-blue-400">
                          {formatCurrency(item.comprasProyectadas)}
                        </td>
                        <td className="py-3 px-2 text-right text-yellow-600 dark:text-yellow-400">
                          {formatCurrency(item.igvAPagar)}
                        </td>
                        <td className="py-3 px-2 text-right text-purple-600 dark:text-purple-400">
                          {formatCurrency(item.rentaEstimada)}
                        </td>
                        <td className={`py-3 px-2 text-right font-medium ${
                          item.flujoNeto >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatCurrency(item.flujoNeto)}
                        </td>
                        <td className={`py-3 px-2 text-right font-bold ${
                          item.flujoAcumulado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatCurrency(item.flujoAcumulado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
