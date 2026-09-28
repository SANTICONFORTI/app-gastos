// Sample group data to preview the design. Replaced by real groups in stage 6.

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
