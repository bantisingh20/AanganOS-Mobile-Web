import { useState } from 'react';
import {
  Home as HomeIcon, Users, Car, Bike, Truck, PawPrint, Plus, Crown, ShieldAlert, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { residents, units as unitsApi, masterData } from '@shared/services';
import { useAsync, useAsyncAction } from '@shared/lib/useAsync';
import { usePermission } from '@shared/lib/usePermission';
import type { ResidentHouseholdUnit } from '@shared/api/residents';
import { PageLayout } from '@app/components/PageLayout';
import { BottomSheet } from '@shared/components/ui/bottom-sheet';
import { TextField } from '@shared/components/TextField';
import { PhoneField } from '@shared/components/PhoneField';
import { SelectField, type SelectOption } from '@shared/components/SelectField';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { FormBanner } from '@shared/components/FormBanner';

function vehicleIcon(type: string): LucideIcon {
  const v = type.toLowerCase();
  if (v.includes('bike') || v.includes('two') || v.includes('motor') || v.includes('scooter')) return Bike;
  if (v.includes('truck') || v.includes('commercial') || v.includes('van')) return Truck;
  return Car;
}

function initials(name: string): string {
  const p = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return (p[0]![0]! + p[1]![0]!).toUpperCase();
}

export function MyHouseholdScreen() {
  const { t } = useTranslation();
  const me = useAsync((signal) => residents.me({ signal }), []);
  const resident = me.data?.resident ?? null;
  const units = me.data?.units ?? [];
  const residentId = resident?.id ?? null;

  const contacts = useAsync(
    (signal) => (residentId ? residents.listEmergencyContacts(residentId, { signal }).catch(() => []) : Promise.resolve([])),
    [residentId],
  );
  const contactList = contacts.data ?? [];
  const [addContact, setAddContact] = useState(false);

  return (
    <PageLayout title={t('myHousehold.title')} subtitle={t('myHousehold.subtitle')}>
      <div className="flex flex-col gap-4 bg-background px-4 py-4">
        {me.loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : !resident ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('myHousehold.noProfile')}</p>
        ) : (
          <>
            {/* Emergency contacts — distinct red-accented card */}
            <div className="overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-border">
              <div className="flex items-center gap-2.5 border-b border-border bg-destructive/5 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10"><ShieldAlert className="h-5 w-5 text-destructive" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold">{t('myHousehold.emergencyContacts')}</div>
                  <div className="text-[11px] text-muted-foreground">{contactList.length} {contactList.length === 1 ? 'contact' : 'contacts'}</div>
                </div>
                {residentId ? <AddBtn onClick={() => setAddContact(true)} /> : null}
              </div>
              {contacts.loading ? <Empty text={t('common.loading')} /> : contactList.length === 0 ? (
                <Empty text={t('myHousehold.noContacts')} />
              ) : (
                <div className="divide-y divide-border">
                  {contactList.map((c) => (
                    <PersonRow key={c.id} name={c.name} sub={`${c.relationship} · ${c.phone}`} tint="#dc2626" />
                  ))}
                </div>
              )}
            </div>

            {units.map((u) => <UnitCard key={u.unitId} unit={u} communityId={u.communityId} />)}
            {units.length === 0 ? (
              <div className="rounded-3xl bg-card py-10 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-border">{t('myHousehold.noUnits')}</div>
            ) : null}
          </>
        )}
      </div>

      {addContact && residentId ? (
        <AddContactSheet residentId={residentId} onClose={() => setAddContact(false)} onSaved={() => { setAddContact(false); contacts.reload(); }} />
      ) : null}
    </PageLayout>
  );
}

function UnitCard({ unit, communityId }: { unit: ResidentHouseholdUnit; communityId: string }) {
  const { t } = useTranslation();
  const perm = usePermission('my-household');

  const household = useAsync((signal) => unitsApi.listHousehold(unit.unitId, { signal }).catch(() => []), [unit.unitId]);
  const vehicles = useAsync((signal) => unitsApi.listVehicles(unit.unitId, { signal }).catch(() => []), [unit.unitId]);
  const pets = useAsync((signal) => unitsApi.listPets(unit.unitId, { signal }).catch(() => []), [unit.unitId]);

  const members = household.data ?? [];
  const vehicleList = vehicles.data ?? [];
  const petList = pets.data ?? [];
  const hasOwner = members.some((m) => m.residentType === 'owner');

  const [sheet, setSheet] = useState<'vehicle' | 'pet' | 'member' | null>(null);

  return (
    <div className="overflow-hidden rounded-3xl bg-card shadow-md ring-1 ring-border">
      {/* Unit hero band */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0b261d] via-primary to-[#0b8f5f] px-5 pb-4 pt-5 text-white">
        <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-black/10" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <HomeIcon className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{t('myHousehold.units')}</div>
            <div className="truncate text-2xl font-extrabold leading-tight">{unit.unitNumber}</div>
            <div className="truncate text-xs capitalize text-white/85">{unit.relationship}{unit.floor ? ` · ${t('myHousehold.floor')} ${unit.floor}` : ''}</div>
          </div>
        </div>
        {/* stat strip */}
        <div className="relative mt-4 grid grid-cols-3 overflow-hidden rounded-2xl bg-white/12 backdrop-blur">
          <Stat icon={Users} value={members.length} label={t('myHousehold.household')} />
          <Stat icon={Car} value={vehicleList.length} label={t('myHousehold.vehicles')} divider />
          <Stat icon={PawPrint} value={petList.length} label={t('myHousehold.pets')} divider />
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Household */}
        <Group title={t('myHousehold.household')} icon={Users} tint="#0ea5e9" onAdd={perm.canAdd ? () => setSheet('member') : undefined}>
          {household.loading ? <GroupEmpty text={t('common.loading')} /> : members.length === 0 ? (
            <GroupEmpty text={t('myHousehold.noMembers')} />
          ) : (
            <div className="flex flex-col gap-2">
              {members.map((m) => {
                const owner = m.residentType === 'owner';
                return (
                  <div key={m.residentId} className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-2.5">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${owner ? 'bg-[#16a34a1f] text-[#16a34a]' : 'bg-[#0ea5e91f] text-[#0ea5e9]'}`}>
                      {initials(m.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{m.name}</span>
                      <span className="block truncate text-xs capitalize text-muted-foreground">{m.relationship}</span>
                    </span>
                    {owner ? (
                      <span className="flex items-center gap-1 rounded-full bg-[#16a34a14] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#16a34a]"><Crown className="h-3 w-3" /> Owner</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase capitalize text-muted-foreground">{m.residentType}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Group>

        {/* Vehicles — chips */}
        <Group title={t('myHousehold.vehicles')} icon={Car} tint="#cf5500" onAdd={perm.canAdd ? () => setSheet('vehicle') : undefined}>
          {vehicles.loading ? <GroupEmpty text={t('common.loading')} /> : vehicleList.length === 0 ? (
            <GroupEmpty text={t('myHousehold.noVehicles')} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {vehicleList.map((v) => {
                const VIcon = vehicleIcon(v.vehicleType);
                return (
                  <div key={v.id} className="flex items-center gap-2.5 rounded-2xl border border-border bg-background/60 p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#cf55001f]"><VIcon className="h-5 w-5 text-[#cf5500]" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold tracking-wide">{v.registrationNumber}</span>
                      <span className="block truncate text-[11px] capitalize text-muted-foreground">{v.vehicleType}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Group>

        {/* Pets — chips */}
        <Group title={t('myHousehold.pets')} icon={PawPrint} tint="#8250df" onAdd={perm.canAdd ? () => setSheet('pet') : undefined}>
          {pets.loading ? <GroupEmpty text={t('common.loading')} /> : petList.length === 0 ? (
            <GroupEmpty text={t('myHousehold.noPets')} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {petList.map((p) => (
                <span key={p.id} className="flex items-center gap-2 rounded-full border border-border bg-[#8250df0d] py-1.5 pl-1.5 pr-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8250df1f]"><PawPrint className="h-4 w-4 text-[#8250df]" /></span>
                  <span className="text-sm font-bold">{p.name ?? p.petType}</span>
                  <span className="text-[11px] capitalize text-muted-foreground">{p.petType}</span>
                </span>
              ))}
            </div>
          )}
        </Group>
      </div>

      {sheet === 'member' ? (
        <AddMemberSheet unitId={unit.unitId} communityId={communityId} addingOwner={!hasOwner} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); household.reload(); }} />
      ) : null}
      {sheet === 'vehicle' ? (
        <AddVehicleSheet unitId={unit.unitId} communityId={communityId} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); vehicles.reload(); }} />
      ) : null}
      {sheet === 'pet' ? (
        <AddPetSheet unitId={unit.unitId} communityId={communityId} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); pets.reload(); }} />
      ) : null}
    </div>
  );
}

function Stat({ icon: Icon, value, label, divider }: { icon: LucideIcon; value: number; label: string; divider?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 py-2.5 ${divider ? 'border-l border-white/15' : ''}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-white/80" />
        <span className="text-lg font-extrabold leading-none">{value}</span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/70">{label}</span>
    </div>
  );
}

function Group({ title, icon: Icon, tint, onAdd, children }: { title: string; icon: LucideIcon; tint: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: `${tint}1f` }}><Icon className="h-3.5 w-3.5" style={{ color: tint }} /></span>
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {onAdd ? <AddBtn onClick={onAdd} /> : null}
      </div>
      {children}
    </div>
  );
}

function AddBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm active:scale-95">
      <Plus className="h-4 w-4" />
    </button>
  );
}

function PersonRow({ name, sub, tint }: { name: string; sub: string; tint: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold" style={{ backgroundColor: `${tint}1f`, color: tint }}>
        {initials(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{name}</span>
        <span className="block truncate text-xs capitalize text-muted-foreground">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
    </div>
  );
}

function GroupEmpty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-border py-4 text-center text-xs text-muted-foreground">{text}</p>;
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

/* ---------------- Add sheets (unchanged logic) ---------------- */

function relationshipOptions(t: (k: string) => string): SelectOption[] {
  return [
    { value: 'spouse', label: t('myHousehold.relSpouse') },
    { value: 'parent', label: t('myHousehold.relParent') },
    { value: 'child', label: t('myHousehold.relChild') },
    { value: 'sibling', label: t('myHousehold.relSibling') },
    { value: 'friend', label: t('myHousehold.relFriend') },
    { value: 'relative', label: t('myHousehold.relRelative') },
    { value: 'other', label: t('myHousehold.relOther') },
  ];
}

function AddMemberSheet({ unitId, communityId, addingOwner, onClose, onSaved }: { unitId: string; communityId: string; addingOwner: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [rel, setRel] = useState<string | null>(null);
  const save = useAsyncAction(async () => {
    const member = await residents.create({
      communityId, name: name.trim(), residentType: addingOwner ? 'owner' : 'family_member',
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
    });
    await residents.associateHousehold(member.id, { unitId, relationship: addingOwner ? 'owner' : (rel ?? 'relative') });
    onSaved();
  });
  const valid = name.trim().length > 0 && (addingOwner || !!rel);
  return (
    <BottomSheet open onClose={onClose} title={addingOwner ? t('myHousehold.addOwner') : t('myHousehold.addMember')}
      footer={<PrimaryButton label={t('myHousehold.add')} loading={save.running} disabled={!valid} onClick={() => void save.run()} />}>
      <div className="flex flex-col gap-3">
        {save.error ? <FormBanner message={save.error.message} /> : null}
        {addingOwner ? <p className="rounded-xl bg-accent px-3 py-2 text-xs text-accent-foreground">{t('myHousehold.ownerNote')}</p> : null}
        <TextField label={t('myHousehold.fullName')} requiredMark value={name} onChange={(e) => setName(e.target.value)} placeholder={t('myHousehold.fullNamePlaceholder')} />
        {!addingOwner ? <SelectField label={t('myHousehold.relationship')} required value={rel} options={relationshipOptions(t)} placeholder={t('myHousehold.selectRelationship')} onChange={setRel} /> : null}
        <PhoneField label={t('myHousehold.contactPhone')} value={phone} onChange={setPhone} />
        <TextField label={t('myHousehold.emailOptional')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('myHousehold.emailPlaceholder')} />
      </div>
    </BottomSheet>
  );
}

function AddContactSheet({ residentId, onClose, onSaved }: { residentId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rel, setRel] = useState<string | null>(null);
  const save = useAsyncAction(async () => {
    await residents.addEmergencyContact(residentId, { name: name.trim(), phone: phone.trim(), relationship: rel! });
    onSaved();
  });
  const valid = name.trim().length > 0 && phone.trim().length > 0 && !!rel;
  return (
    <BottomSheet open onClose={onClose} title={t('myHousehold.addContact')}
      footer={<PrimaryButton label={t('myHousehold.add')} loading={save.running} disabled={!valid} onClick={() => void save.run()} />}>
      <div className="flex flex-col gap-3">
        {save.error ? <FormBanner message={save.error.message} /> : null}
        <TextField label={t('myHousehold.contactName')} requiredMark value={name} onChange={(e) => setName(e.target.value)} placeholder={t('myHousehold.contactNamePlaceholder')} />
        <PhoneField label={t('myHousehold.contactPhone')} value={phone} onChange={setPhone} />
        <SelectField label={t('myHousehold.relationship')} required value={rel} options={relationshipOptions(t)} placeholder={t('myHousehold.selectRelationship')} onChange={setRel} />
      </div>
    </BottomSheet>
  );
}

function AddVehicleSheet({ unitId, communityId, onClose, onSaved }: { unitId: string; communityId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [reg, setReg] = useState('');
  const [type, setType] = useState<string | null>(null);
  const cats = useAsync((signal) => masterData.list('Vehicle_Type', communityId, { signal }).catch(() => []), [communityId]);
  const options: SelectOption[] = (cats.data ?? []).map((c) => ({ value: c.code, label: c.label }));
  const save = useAsyncAction(async () => {
    await unitsApi.registerVehicle({ unitId, registrationNumber: reg.trim(), vehicleType: type! });
    onSaved();
  });
  const valid = reg.trim().length > 0 && !!type;
  const PreviewIcon = type ? vehicleIcon(type) : Car;
  return (
    <BottomSheet open onClose={onClose} title={t('myHousehold.addVehicle')}
      footer={<PrimaryButton label={t('myHousehold.add')} loading={save.running} disabled={!valid} onClick={() => void save.run()} />}>
      <div className="flex flex-col gap-3">
        {save.error ? <FormBanner message={save.error.message} /> : null}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#cf55001f]"><PreviewIcon className="h-10 w-10" style={{ color: '#cf5500' }} /></div>
        <SelectField label={t('myHousehold.vehicleType')} required value={type} options={options} placeholder={t('myHousehold.selectVehicleType')} onChange={setType} />
        <TextField label={t('myHousehold.registrationNumber')} requiredMark value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} placeholder={t('myHousehold.regPlaceholder')} />
      </div>
    </BottomSheet>
  );
}

function AddPetSheet({ unitId, communityId, onClose, onSaved }: { unitId: string; communityId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<string | null>(null);
  const cats = useAsync((signal) => masterData.list('Pet_Type', communityId, { signal }).catch(() => []), [communityId]);
  const fallback: SelectOption[] = [
    { value: 'dog', label: 'Dog' }, { value: 'cat', label: 'Cat' }, { value: 'bird', label: 'Bird' }, { value: 'other', label: 'Other' },
  ];
  const options: SelectOption[] = (cats.data ?? []).length > 0 ? (cats.data ?? []).map((c) => ({ value: c.code, label: c.label })) : fallback;
  const save = useAsyncAction(async () => {
    await unitsApi.registerPet({ unitId, petType: type!, ...(name.trim() ? { name: name.trim() } : {}) });
    onSaved();
  });
  const valid = !!type;
  return (
    <BottomSheet open onClose={onClose} title={t('myHousehold.addPet')}
      footer={<PrimaryButton label={t('myHousehold.add')} loading={save.running} disabled={!valid} onClick={() => void save.run()} />}>
      <div className="flex flex-col gap-3">
        {save.error ? <FormBanner message={save.error.message} /> : null}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#8250df1f]"><PawPrint className="h-10 w-10" style={{ color: '#8250df' }} /></div>
        <SelectField label={t('myHousehold.petType')} required value={type} options={options} placeholder={t('myHousehold.selectPetType')} onChange={setType} />
        <TextField label={t('myHousehold.petName')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('myHousehold.petNamePlaceholder')} />
      </div>
    </BottomSheet>
  );
}
