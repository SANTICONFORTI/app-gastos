import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Copy, Ban } from 'lucide-react'
import Sheet from './Sheet'
import SheetHeader from './SheetHeader'
import Pressable from './Pressable'
import UserAvatar from './UserAvatar'
import { VoidForm } from './ExpenseDetailSheet'
import { useGroups } from '../store/GroupsStore'
import { useAuth } from '../store/AuthProvider'
import { amountToInput, formatAmountInput, parseAmountInput } from '../lib/amountInput'
import { formatMoney } from '../lib/format'
import { formatWhen } from '../lib/dates'
import { friendlyError } from '../lib/db'

/** Pay / settle a debt: shows the creditor's alias to copy and records the payment. */
export function SettleSheet({ transfer, onClose, onDone, onNotice }) {
  return (
    <Sheet open={Boolean(transfer)} onClose={onClose} labelledBy="settle-title" space="group">
      {transfer && <Settle transfer={transfer} onClose={onClose} onDone={onDone} onNotice={onNotice} />}
    </Sheet>
  )
}

function Settle({ transfer, onClose, onDone, onNotice }) {
  const groups = useGroups()
  const { user } = useAuth()
  const from = groups.memberById[transfer.from]
  const to = groups.memberById[transfer.to]
  const mine = transfer.from === user.id
  const [amountText, setAmountText] = useState(amountToInput(transfer.amount))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const amount = parseAmountInput(amountText)
  const alias = to?.profile?.alias_cvu

  async function copyAlias() {
    try {
      await navigator.clipboard.writeText(alias)
      onNotice('Alias copiado: pegalo en tu banco o billetera')
    } catch {
      onNotice('No se pudo copiar')
    }
  }

  async function register() {
    if (!(amount > 0)) return setError('Ingresá un monto mayor a cero.')
    setBusy(true)
    setError('')
    try {
      await groups.addSettlement(groups.groupId, { from: transfer.from, to: transfer.to, amount: Math.round(amount * 100) / 100 })
      onDone(mine ? 'Pago registrado. ¡Gracias!' : 'Pago registrado')
    } catch (e) {
      setError(friendlyError(e))
      setBusy(false)
    }
  }

  const toName = to?.profile?.display_name ?? 'Alguien'
  return (
    <div className="detail">
      <SheetHeader id="settle-title" title={mine ? 'Pagar' : 'Saldar deuda'} onClose={onClose} />

      <div className="settle-people">
        <span className="settle-person"><UserAvatar profile={from?.profile} size={56} /><span>{mine ? 'Vos' : from?.profile?.display_name}</span></span>
        <ArrowRight size={22} strokeWidth={2.2} aria-hidden="true" />
        <span className="settle-person"><UserAvatar profile={to?.profile} size={56} /><span>{toName}</span></span>
      </div>

      <label className="field settle-amount">
        <span className="field-label">Monto</span>
        <span className="input-wrap glass">
          <span aria-hidden="true">$</span>
          <input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(formatAmountInput(e.target.value, amountText))} />
        </span>
        <span className="field-hint">La deuda es de {formatMoney(transfer.amount)}. Podés registrar un pago parcial.</span>
      </label>

      <div className="alias-box glass">
        <span className="muted-sm">Alias / CVU de {toName}</span>
        {alias ? (
          <button type="button" className="alias-copy" onClick={copyAlias} aria-label={`Copiar ${alias}`}>
            <span>{alias}</span> <Copy size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : (
          <span className="muted-sm">{toName} todavía no cargó su alias. Pedíselo por mensaje.</span>
        )}
      </div>

      <ol className="settle-steps muted-sm">
        <li>Transferí desde tu banco o billetera.</li>
        <li>Tocá “{mine ? 'Ya pagué' : 'Registrar pago'}” para que el grupo lo vea.</li>
      </ol>

      {error && <p className="form-error" role="alert">{error}</p>}
      <Pressable className="btn btn-primary btn-lg" disabled={busy} onClick={register}>
        {busy ? 'Registrando…' : mine ? 'Ya pagué' : `Registrar que ${from?.profile?.display_name?.split(' ')[0] ?? 'pagó'} pagó`}
      </Pressable>
    </div>
  )
}

/** A recorded payment; admins can void it with a reason. */
export function SettlementDetailSheet({ settlementId, onClose, onDone }) {
  return (
    <Sheet open={Boolean(settlementId)} onClose={onClose} labelledBy="settlement-title" space="group">
      {settlementId && <SettlementDetail settlementId={settlementId} onClose={onClose} onDone={onDone} />}
    </Sheet>
  )
}

function SettlementDetail({ settlementId, onClose, onDone }) {
  const groups = useGroups()
  const s = groups.settlements.find((x) => x.id === settlementId)
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!s) return null
  const nameOf = (id) => groups.memberById[id]?.profile?.display_name ?? 'Alguien'
  const voided = s.status === 'voided'

  async function confirmVoid() {
    setBusy(true)
    setError('')
    try {
      await groups.voidSettlement(s.id, reason)
      onDone('Pago anulado. Queda en el historial')
    } catch (e) {
      setError(friendlyError(e))
      setBusy(false)
    }
  }

  return (
    <div className="detail">
      <SheetHeader id="settlement-title" title="Pago" onClose={onClose} />
      <div className="settle-people">
        <span className="settle-person"><UserAvatar profile={groups.memberById[s.from_user]?.profile} size={56} /><span>{nameOf(s.from_user)}</span></span>
        <ArrowRight size={22} strokeWidth={2.2} aria-hidden="true" />
        <span className="settle-person"><UserAvatar profile={groups.memberById[s.to_user]?.profile} size={56} /><span>{nameOf(s.to_user)}</span></span>
      </div>
      <p className={`settle-total ${voided ? 'is-voided' : ''}`}>{formatMoney(Number(s.amount))}</p>
      <dl className="detail-list glass">
        <div><dt>Registrado por</dt><dd>{nameOf(s.created_by)}</dd></div>
        <div><dt>Cuándo</dt><dd>{formatWhen(s.created_at)}</dd></div>
      </dl>
      {voided && (
        <div className="void-banner" role="note">
          <Ban size={18} strokeWidth={2} aria-hidden="true" />
          <span>Anulado por {nameOf(s.voided_by)} · {formatWhen(s.voided_at)} · “{s.void_reason}”. No cuenta en las deudas.</span>
        </div>
      )}
      {groups.isAdmin && !voided && (
        <AnimatePresence mode="wait" initial={false}>
          {voiding ? (
            <VoidForm
              key="void"
              title="¿Por qué anulás este pago?"
              explanation="No se borra: queda tachado para todos, con tu nombre, la fecha y este motivo."
              confirmLabel="Anular pago"
              reason={reason}
              setReason={setReason}
              busy={busy}
              error={error}
              onCancel={() => setVoiding(false)}
              onConfirm={confirmVoid}
            />
          ) : (
            <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Pressable className="btn btn-danger-ghost btn-lg full-btn" onClick={() => setVoiding(true)}><Ban size={16} strokeWidth={2.2} /> Anular pago</Pressable>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
