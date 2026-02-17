import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Menús base del sistema
const MENUS_BASE = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/', orden: 1 },
  { key: 'comprobantes', label: 'Comprobantes', icon: 'FileText', path: '/comprobantes', orden: 2 },
  { key: 'importar', label: 'Importar', icon: 'Upload', path: '/importar', orden: 3 },
  { key: 'terceros', label: 'Terceros', icon: 'Users', path: '/terceros', orden: 4 },
  { key: 'flujo-caja', label: 'Flujo de Caja', icon: 'Wallet', path: '/flujo-caja', orden: 5 },
  { key: 'inventario', label: 'Inventario', icon: 'Package', path: '/inventario', orden: 6 },
  { key: 'fotochecks', label: 'Fotochecks', icon: 'Camera', path: '/fotochecks', orden: 7 },
  { key: 'renombrar-imagenes', label: 'Renombrar Imágenes', icon: 'ScanLine', path: '/renombrar-imagenes', orden: 8 },
  { key: 'declaraciones', label: 'Declaraciones', icon: 'Calculator', path: '/declaraciones', orden: 9 },
  { key: 'facturador', label: 'Facturador', icon: 'Receipt', path: '/facturador', orden: 10 },
  { key: 'reportes', label: 'Reportes', icon: 'BarChart3', path: '/reportes', orden: 11 },
  { key: 'libros', label: 'Libros Electrónicos', icon: 'BookOpen', path: '/libros', orden: 12 },
  { key: 'alertas', label: 'Alertas', icon: 'Bell', path: '/alertas', orden: 13 },
  { key: 'asistente', label: 'Asistente IA', icon: 'Bot', path: '/asistente', orden: 14 },
  { key: 'configuracion', label: 'Configuración', icon: 'Settings', path: '/configuracion', orden: 99 },
];

// Configuración de cada plan
const PLAN_CONFIGS = [
  {
    plan: 'FREE' as const,
    nombre: 'Plan Gratuito',
    descripcion: 'Ideal para emprendedores que inician',
    precioMensual: 0,
    precioAnual: 0,
    maxEmpresas: 1,
    maxComprobantes: 50,
    maxStorage: BigInt(26214400), // 25MB
    maxUsuarios: 1,
    iaEnabled: false,
    iaMaxConsultas: 0,
    iaModelo: null,
    facturacionEnabled: false,
    reportesAvanzados: false,
    librosElectronicos: false,
    alertasEnabled: false,
    apiAccess: false,
    soportePrioritario: false,
    menusHabilitados: ['dashboard', 'comprobantes', 'importar', 'terceros', 'renombrar-imagenes', 'configuracion'],
  },
  {
    plan: 'BASIC' as const,
    nombre: 'Plan Básico',
    descripcion: 'Para pequeñas empresas en crecimiento',
    precioMensual: 29.90,
    precioAnual: 299.00,
    maxEmpresas: 3,
    maxComprobantes: 500,
    maxStorage: BigInt(104857600), // 100MB
    maxUsuarios: 2,
    iaEnabled: true,
    iaMaxConsultas: 50,
    iaModelo: 'claude-3-haiku',
    facturacionEnabled: true,
    reportesAvanzados: false,
    librosElectronicos: false,
    alertasEnabled: true,
    apiAccess: false,
    soportePrioritario: false,
    menusHabilitados: ['dashboard', 'comprobantes', 'importar', 'terceros', 'flujo-caja', 'inventario', 'fotochecks', 'renombrar-imagenes', 'declaraciones', 'facturador', 'alertas', 'asistente', 'configuracion'],
  },
  {
    plan: 'PRO' as const,
    nombre: 'Plan Profesional',
    descripcion: 'Todas las funcionalidades para empresas establecidas',
    precioMensual: 79.90,
    precioAnual: 799.00,
    maxEmpresas: 999,
    maxComprobantes: 0, // ilimitado
    maxStorage: BigInt(524288000), // 500MB
    maxUsuarios: 10,
    iaEnabled: true,
    iaMaxConsultas: 0, // ilimitado
    iaModelo: 'claude-3-sonnet',
    facturacionEnabled: true,
    reportesAvanzados: true,
    librosElectronicos: true,
    alertasEnabled: true,
    apiAccess: true,
    soportePrioritario: true,
    menusHabilitados: ['dashboard', 'comprobantes', 'importar', 'terceros', 'flujo-caja', 'inventario', 'fotochecks', 'renombrar-imagenes', 'declaraciones', 'facturador', 'reportes', 'libros', 'alertas', 'asistente', 'configuracion'],
  },
];

// Configuración de proveedores de IA
const AI_PROVIDERS = [
  {
    provider: 'anthropic',
    displayName: 'Anthropic (Claude)',
    isEnabled: true,
    isDefault: true,
    modelos: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229', 'claude-3-5-sonnet-20241022'],
    modeloDefault: 'claude-3-5-sonnet-20241022',
    maxTokensInput: 200000,
    maxTokensOutput: 4096,
    costoPorInputToken: 0.000003,
    costoPorOutputToken: 0.000015,
    credentialsKey: 'ANTHROPIC_API_KEY',
  },
  {
    provider: 'bedrock',
    displayName: 'AWS Bedrock',
    isEnabled: false,
    isDefault: false,
    modelos: ['anthropic.claude-3-haiku-20240307-v1:0', 'anthropic.claude-3-sonnet-20240229-v1:0', 'anthropic.claude-3-5-sonnet-20241022-v2:0'],
    modeloDefault: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    maxTokensInput: 200000,
    maxTokensOutput: 4096,
    costoPorInputToken: 0.000003,
    costoPorOutputToken: 0.000015,
    credentialsKey: 'AWS_ACCESS_KEY_ID',
    region: 'us-east-1',
  },
];

async function seedPlans() {
  console.log('🌱 Iniciando seed de planes...');

  for (const planConfig of PLAN_CONFIGS) {
    const { menusHabilitados, ...planData } = planConfig;

    // Crear o actualizar configuración del plan
    const existingPlan = await prisma.planConfig.findUnique({
      where: { plan: planData.plan },
    });

    let planRecord;
    if (existingPlan) {
      planRecord = await prisma.planConfig.update({
        where: { plan: planData.plan },
        data: planData,
      });
      console.log(`  ✓ Plan ${planData.plan} actualizado`);
    } else {
      planRecord = await prisma.planConfig.create({
        data: planData,
      });
      console.log(`  ✓ Plan ${planData.plan} creado`);
    }

    // Eliminar menús antiguos que ya no existen en MENUS_BASE
    const validMenuKeys = MENUS_BASE.map(m => m.key);
    await prisma.planMenuItem.deleteMany({
      where: {
        planConfigId: planRecord.id,
        menuKey: { notIn: validMenuKeys },
      },
    });

    // Crear/actualizar menús para el plan
    for (const menu of MENUS_BASE) {
      const isEnabled = menusHabilitados.includes(menu.key);

      await prisma.planMenuItem.upsert({
        where: {
          planConfigId_menuKey: {
            planConfigId: planRecord.id,
            menuKey: menu.key,
          },
        },
        update: {
          label: menu.label,
          icon: menu.icon,
          path: menu.path,
          orden: menu.orden,
          isEnabled,
          isVisible: isEnabled,
        },
        create: {
          planConfigId: planRecord.id,
          menuKey: menu.key,
          label: menu.label,
          icon: menu.icon,
          path: menu.path,
          orden: menu.orden,
          isEnabled,
          isVisible: isEnabled,
        },
      });
    }
    console.log(`  ✓ Menús configurados para ${planData.plan} (${MENUS_BASE.length} menús)`);
  }

  // Crear proveedores de IA
  console.log('\n🤖 Configurando proveedores de IA...');
  for (const provider of AI_PROVIDERS) {
    await prisma.aIProviderConfig.upsert({
      where: { provider: provider.provider },
      update: {
        displayName: provider.displayName,
        isEnabled: provider.isEnabled,
        isDefault: provider.isDefault,
        modelos: provider.modelos,
        modeloDefault: provider.modeloDefault,
        maxTokensInput: provider.maxTokensInput,
        maxTokensOutput: provider.maxTokensOutput,
        costoPorInputToken: provider.costoPorInputToken,
        costoPorOutputToken: provider.costoPorOutputToken,
        credentialsKey: provider.credentialsKey,
        region: provider.region || null,
      },
      create: {
        provider: provider.provider,
        displayName: provider.displayName,
        isEnabled: provider.isEnabled,
        isDefault: provider.isDefault,
        modelos: provider.modelos,
        modeloDefault: provider.modeloDefault,
        maxTokensInput: provider.maxTokensInput,
        maxTokensOutput: provider.maxTokensOutput,
        costoPorInputToken: provider.costoPorInputToken,
        costoPorOutputToken: provider.costoPorOutputToken,
        credentialsKey: provider.credentialsKey,
        region: provider.region || null,
      },
    });
    console.log(`  ✓ Proveedor ${provider.displayName} configurado`);
  }

  console.log('\n✅ Seed completado exitosamente!');
}

seedPlans()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
