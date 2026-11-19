import { toCsv, type CsvValue } from "@/lib/export/csv";
import { packStoreZip } from "@/lib/export/zip-store";
import { withTenant, type PrismaTx } from "@/lib/db/rls";

export type Sheet = {
  name: string;
  headers: readonly string[];
  rows: (tx: PrismaTx, tenantId: string) => Promise<CsvValue[][]>;
};

export type TenantCsvFile = {
  name: string;
  csv: string;
};

export type TenantCsvExport = {
  files: TenantCsvFile[];
  zip: Buffer;
};

const TENANT_HEADERS = [
  "id",
  "slug",
  "name",
  "industrySlug",
  "subscriptionValidated",
  "createdAt",
  "updatedAt",
] as const;

const TENANT_SETTINGS_HEADERS = [
  "tenantId",
  "locale",
  "currency",
  "timezone",
  "phoneFormat",
  "whatsappCountryCode",
  "dealIdPrefix",
  "dealIdYearDigits",
  "defaultPipelineId",
  "storageMaxBytes",
  "storageUsedBytes",
  "fileSizeMaxBytes",
  "pinEnabled",
  "pinUnlockWindowSeconds",
] as const;

const TENANT_BRANDING_HEADERS = [
  "tenantId",
  "logoUrl",
  "primaryColor",
  "bgColorLight",
  "bgColorDark",
  "bgImageUrl",
  "headerBgColor",
  "kpiBgColor",
  "productName",
] as const;

const MEMBERSHIP_HEADERS = [
  "id",
  "userId",
  "tenantId",
  "role",
  "status",
  "createdAt",
  "email",
  "name",
] as const;

const INVITATION_HEADERS = [
  "id",
  "tenantId",
  "email",
  "role",
  "expiresAt",
  "acceptedAt",
  "createdAt",
] as const;

const JOIN_LINK_HEADERS = [
  "id",
  "tenantId",
  "role",
  "label",
  "expiresAt",
  "revokedAt",
  "createdAt",
  "updatedAt",
] as const;

const PIPELINE_HEADERS = ["id", "tenantId", "name", "isDefault", "createdAt", "updatedAt"] as const;

const PIPELINE_STAGE_HEADERS = [
  "id",
  "tenantId",
  "pipelineId",
  "order",
  "key",
  "label",
  "sublabel",
  "color",
  "iconKey",
  "locked",
  "requiresQuote",
  "requiresPayment",
] as const;

const CATALOG_ITEM_HEADERS = [
  "id",
  "tenantId",
  "catalogKey",
  "key",
  "label",
  "color",
  "iconKey",
  "metadata",
  "order",
  "active",
  "parentId",
] as const;

const CUSTOM_FIELD_HEADERS = [
  "id",
  "tenantId",
  "entity",
  "key",
  "label",
  "type",
  "options",
  "required",
  "order",
  "metadata",
  "createdAt",
] as const;

const CLIENT_HEADERS = [
  "id",
  "tenantId",
  "name",
  "company",
  "phone",
  "whatsapp",
  "email",
  "address",
  "notes",
  "customData",
  "createdAt",
  "updatedAt",
] as const;

const DEAL_HEADERS = [
  "id",
  "tenantId",
  "pipelineId",
  "stageId",
  "clientId",
  "ownerId",
  "createdById",
  "channelKey",
  "statusKey",
  "name",
  "company",
  "phone",
  "whatsapp",
  "email",
  "value",
  "isArchived",
  "archiveReasonKey",
  "archiveNote",
  "customData",
  "createdAt",
  "stageEnteredAt",
  "updatedAt",
] as const;

const DEAL_EQUIPMENT_HEADERS = ["dealId", "categoryKey", "subcategoryKey"] as const;

const DEAL_VIEWER_HEADERS = ["id", "tenantId", "dealId", "userId", "createdAt"] as const;

const QUOTE_HEADERS = [
  "id",
  "tenantId",
  "dealId",
  "number",
  "date",
  "fileUrl",
  "isVoid",
  "customData",
  "createdAt",
] as const;

const PAYMENT_HEADERS = [
  "id",
  "tenantId",
  "dealId",
  "number",
  "date",
  "fileUrl",
  "isVoid",
  "customData",
  "createdAt",
] as const;

const ATTACHMENT_HEADERS = [
  "id",
  "tenantId",
  "dealId",
  "clientId",
  "url",
  "mimeType",
  "size",
  "key",
  "createdAt",
] as const;

const FOLLOW_UP_HEADERS = [
  "id",
  "tenantId",
  "dealId",
  "date",
  "note",
  "result",
  "completed",
  "completedAt",
  "createdById",
  "createdAt",
] as const;

const NOTE_HEADERS = [
  "id",
  "tenantId",
  "dealId",
  "clientId",
  "text",
  "createdById",
  "createdAt",
] as const;

const ACTIVITY_HEADERS = [
  "id",
  "tenantId",
  "entity",
  "entityId",
  "type",
  "payload",
  "userId",
  "createdAt",
] as const;

const SAVED_VIEW_HEADERS = [
  "id",
  "tenantId",
  "userId",
  "entity",
  "name",
  "config",
  "createdAt",
] as const;

const COUNTER_HEADERS = ["tenantId", "key", "value"] as const;

const ROLE_PERMISSION_HEADERS = ["tenantId", "role", "key", "allowed", "updatedAt"] as const;

const USER_PERMISSION_HEADERS = ["tenantId", "userId", "key", "allowed", "updatedAt"] as const;

function project(record: object, headers: readonly string[]): CsvValue[] {
  const row = record as Record<string, CsvValue | undefined>;
  return headers.map((key) => row[key] ?? null);
}

function listed(
  name: string,
  headers: readonly string[],
  load: (tx: PrismaTx, tenantId: string) => Promise<readonly object[]>
): Sheet {
  return {
    name,
    headers,
    rows: async (tx, tenantId) =>
      (await load(tx, tenantId)).map((record) => project(record, headers)),
  };
}

function singleton(
  name: string,
  headers: readonly string[],
  load: (tx: PrismaTx, tenantId: string) => Promise<object | null>
): Sheet {
  return {
    name,
    headers,
    rows: async (tx, tenantId) => {
      const record = await load(tx, tenantId);
      return record ? [project(record, headers)] : [];
    },
  };
}

const SHEETS: readonly Sheet[] = [
  singleton("tenant.csv", TENANT_HEADERS, (tx, tenantId) =>
    tx.tenant.findUnique({ where: { id: tenantId } })
  ),
  singleton("tenant_settings.csv", TENANT_SETTINGS_HEADERS, (tx, tenantId) =>
    tx.tenantSettings.findUnique({ where: { tenantId } })
  ),
  singleton("tenant_branding.csv", TENANT_BRANDING_HEADERS, (tx, tenantId) =>
    tx.tenantBranding.findUnique({ where: { tenantId } })
  ),
  {
    name: "memberships.csv",
    headers: MEMBERSHIP_HEADERS,
    rows: async (tx, tenantId) => {
      const memberships = await tx.membership.findMany({
        where: { tenantId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          userId: true,
          tenantId: true,
          role: true,
          status: true,
          createdAt: true,
          user: { select: { email: true, name: true } },
        },
      });
      return memberships.map((membership) =>
        project(
          {
            id: membership.id,
            userId: membership.userId,
            tenantId: membership.tenantId,
            role: membership.role,
            status: membership.status,
            createdAt: membership.createdAt,
            email: membership.user.email,
            name: membership.user.name,
          },
          MEMBERSHIP_HEADERS
        )
      );
    },
  },
  {
    name: "invitations.csv",
    headers: INVITATION_HEADERS,
    rows: async (tx, tenantId) => {
      const invitations = await tx.invitation.findMany({
        where: { tenantId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          tenantId: true,
          email: true,
          role: true,
          expiresAt: true,
          acceptedAt: true,
          createdAt: true,
        },
      });
      return invitations.map((row) => project(row, INVITATION_HEADERS));
    },
  },
  {
    name: "join_links.csv",
    headers: JOIN_LINK_HEADERS,
    rows: async (tx, tenantId) => {
      const links = await tx.joinLink.findMany({
        where: { tenantId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          tenantId: true,
          role: true,
          label: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return links.map((row) => project(row, JOIN_LINK_HEADERS));
    },
  },
  listed("pipelines.csv", PIPELINE_HEADERS, (tx, tenantId) =>
    tx.pipeline.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("pipeline_stages.csv", PIPELINE_STAGE_HEADERS, (tx, tenantId) =>
    tx.pipelineStage.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("catalog_items.csv", CATALOG_ITEM_HEADERS, (tx, tenantId) =>
    tx.catalogItem.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("custom_field_definitions.csv", CUSTOM_FIELD_HEADERS, (tx, tenantId) =>
    tx.customFieldDefinition.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("clients.csv", CLIENT_HEADERS, (tx, tenantId) =>
    tx.client.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("deals.csv", DEAL_HEADERS, (tx, tenantId) =>
    tx.deal.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("deal_equipment.csv", DEAL_EQUIPMENT_HEADERS, (tx, tenantId) =>
    tx.dealEquipment.findMany({
      where: { deal: { tenantId } },
      orderBy: [{ dealId: "asc" }, { subcategoryKey: "asc" }],
    })
  ),
  listed("deal_viewers.csv", DEAL_VIEWER_HEADERS, (tx, tenantId) =>
    tx.dealViewer.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("quotes.csv", QUOTE_HEADERS, (tx, tenantId) =>
    tx.quote.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("payments.csv", PAYMENT_HEADERS, (tx, tenantId) =>
    tx.payment.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("attachments.csv", ATTACHMENT_HEADERS, (tx, tenantId) =>
    tx.attachment.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("follow_ups.csv", FOLLOW_UP_HEADERS, (tx, tenantId) =>
    tx.followUp.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("notes.csv", NOTE_HEADERS, (tx, tenantId) =>
    tx.note.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("activities.csv", ACTIVITY_HEADERS, (tx, tenantId) =>
    tx.activity.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("saved_views.csv", SAVED_VIEW_HEADERS, (tx, tenantId) =>
    tx.savedView.findMany({ where: { tenantId }, orderBy: { id: "asc" } })
  ),
  listed("counters.csv", COUNTER_HEADERS, (tx, tenantId) =>
    tx.counter.findMany({ where: { tenantId }, orderBy: { key: "asc" } })
  ),
  listed("role_permissions.csv", ROLE_PERMISSION_HEADERS, (tx, tenantId) =>
    tx.rolePermission.findMany({
      where: { tenantId },
      orderBy: [{ role: "asc" }, { key: "asc" }],
    })
  ),
  listed("user_permissions.csv", USER_PERMISSION_HEADERS, (tx, tenantId) =>
    tx.userPermission.findMany({
      where: { tenantId },
      orderBy: [{ userId: "asc" }, { key: "asc" }],
    })
  ),
];

export async function buildTenantCsvExport(tenantId: string): Promise<TenantCsvExport> {
  const files = await withTenant(
    tenantId,
    async (tx) => {
      const built: TenantCsvFile[] = [];
      for (const sheet of SHEETS) {
        const data = await sheet.rows(tx, tenantId);
        built.push({ name: sheet.name, csv: toCsv(sheet.headers, data) });
      }
      return built;
    },
    { timeout: 60_000 }
  );

  const zip = packStoreZip(
    files.map((file) => ({ name: file.name, bytes: Buffer.from(file.csv, "utf8") }))
  );
  return { files, zip };
}
