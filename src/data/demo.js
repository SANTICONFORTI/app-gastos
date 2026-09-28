// Sample data to preview the design during stage 1.
// Replaced by real data in stage 2 (personal) and stage 6 (groups).

export const demoPersonal = {
  monthLabel: 'Septiembre',
  total: 684200,
  previousTotal: 610900,
  blueRate: 1385,
  antTotal: 41300,
  byCategory: [
    { categoryId: 'comida', amount: 239470 },
    { categoryId: 'servicios', amount: 164210 },
    { categoryId: 'transporte', amount: 136840 },
    { categoryId: 'salidas', amount: 82100 },
    { categoryId: 'otros', amount: 61580 },
  ],
  movements: [
    { id: 'p1', title: 'Supermercado', detail: 'Hoy, 18:32 · con ticket', amount: 58400, categoryId: 'comida' },
    { id: 'p2', title: 'SUBE', detail: 'Ayer, 09:10', amount: 15000, categoryId: 'transporte' },
    { id: 'p3', title: 'Luz', detail: 'Lun 22, 11:05', amount: 42300, categoryId: 'servicios' },
  ],
}

export const demoGroup = {
  name: 'Depto Palermo',
  monthLabel: 'septiembre',
  total: 1248000,
  onlineCount: 3,
  isAdmin: true,
  members: [
    { id: 'me', name: 'Vos', initials: 'VOS', color: '#A78BFA' },
    { id: 's', name: 'Sofi', initials: 'S', color: '#FFB547' },
    { id: 'j', name: 'Juan', initials: 'J', color: '#5AC8FA' },
    { id: 'm', name: 'Mica', initials: 'M', color: '#FF7A96' },
  ],
  debts: [
    { from: 'j', to: 's', amount: 45500 },
    { from: 'me', to: 's', amount: 12800 },
  ],
  movements: [
    { id: 'g1', title: 'Expensas septiembre', paidBy: 's', detail: 'hace 2 min', amount: 182000, splitCount: 4 },
    { id: 'g2', title: 'Compra del mes', paidBy: 'j', detail: 'con ticket', amount: 96300, splitCount: 4 },
    {
      id: 'g3',
      title: 'Internet',
      paidBy: 's',
      amount: 38900,
      splitCount: 4,
      voided: { by: 'Sofi (admin)', when: 'ayer 21:14', reason: 'cargado dos veces' },
    },
  ],
}
