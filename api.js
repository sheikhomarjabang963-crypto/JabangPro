import { supabase } from "./supabase";

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------- Auth / session bootstrap ----------

export async function getMyProfile(userId) {
  return unwrap(await supabase.from("profiles").select("*").eq("id", userId).single());
}

export async function getIsSuperAdmin() {
  return unwrap(await supabase.rpc("is_super_admin"));
}

export async function getMyMemberships() {
  return unwrap(
    await supabase
      .from("business_members")
      .select("id, business_id, role, permissions, branch_id, businesses(id, name, status, trial_end)")
  );
}

export async function getDefaultBranch(businessId) {
  const rows = unwrap(
    await supabase.from("branches").select("*").eq("business_id", businessId).order("is_default", { ascending: false })
  );
  return rows?.[0] || null;
}

export async function getMyApplication(userId) {
  const rows = unwrap(
    await supabase
      .from("business_applications")
      .select("*")
      .eq("applicant_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
  );
  return rows?.[0] || null;
}

export async function submitApplication({ businessName, contactName, phone, email }) {
  return unwrap(
    await supabase
      .from("business_applications")
      .insert({ business_name: businessName, contact_name: contactName, phone, email })
      .select()
      .single()
  );
}

// ---------- Super Admin ----------

export async function listApplications() {
  return unwrap(
    await supabase.from("business_applications").select("*").order("created_at", { ascending: false })
  );
}

export async function approveApplication(applicationId) {
  return unwrap(await supabase.rpc("approve_business_application", { p_application_id: applicationId }));
}

export async function rejectApplication(applicationId, reason) {
  return unwrap(
    await supabase.rpc("reject_business_application", { p_application_id: applicationId, p_reason: reason })
  );
}

export async function listBusinesses() {
  return unwrap(await supabase.from("businesses").select("*").order("created_at", { ascending: false }));
}

export async function suspendBusiness(businessId) {
  return unwrap(await supabase.rpc("suspend_business", { p_business_id: businessId }));
}

export async function reactivateBusiness(businessId) {
  return unwrap(await supabase.rpc("reactivate_business", { p_business_id: businessId }));
}

export async function recordBusinessPayment(businessId, amount, periodStart, periodEnd, note) {
  return unwrap(
    await supabase.rpc("record_business_payment", {
      p_business_id: businessId,
      p_amount: amount,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_note: note
    })
  );
}

// ---------- Categories / Products ----------

export async function listCategories(businessId) {
  return unwrap(
    await supabase.from("categories").select("*").eq("business_id", businessId).order("name")
  );
}

export async function createCategory(businessId, name) {
  return unwrap(
    await supabase.from("categories").insert({ business_id: businessId, name }).select().single()
  );
}

export async function listProducts(businessId) {
  return unwrap(
    await supabase
      .from("products")
      .select("*, categories(name)")
      .eq("business_id", businessId)
      .order("name")
  );
}

export async function createProduct(businessId, product) {
  return unwrap(
    await supabase.from("products").insert({ business_id: businessId, ...product }).select().single()
  );
}

export async function updateProduct(productId, patch) {
  return unwrap(await supabase.from("products").update(patch).eq("id", productId).select().single());
}

// ---------- Inventory ----------

export async function listInventory(businessId, branchId) {
  return unwrap(
    await supabase
      .from("inventory")
      .select("id, quantity, product_id, products(name, sku, low_stock_threshold, cost_price, selling_price)")
      .eq("business_id", businessId)
      .eq("branch_id", branchId)
  );
}

export async function adjustInventory(businessId, branchId, productId, changeQty, reason) {
  return unwrap(
    await supabase.rpc("adjust_inventory", {
      p_business_id: businessId,
      p_branch_id: branchId,
      p_product_id: productId,
      p_change_qty: changeQty,
      p_reason: reason
    })
  );
}

// ---------- Customers ----------

export async function listCustomers(businessId) {
  return unwrap(
    await supabase.from("customers").select("*").eq("business_id", businessId).order("name")
  );
}

export async function createCustomer(businessId, customer) {
  return unwrap(
    await supabase.from("customers").insert({ business_id: businessId, ...customer }).select().single()
  );
}

export async function updateCustomer(customerId, patch) {
  return unwrap(await supabase.from("customers").update(patch).eq("id", customerId).select().single());
}

// ---------- POS / Sales ----------

export async function getPosCatalog(businessId, branchId) {
  return unwrap(
    await supabase.rpc("get_pos_catalog", { p_business_id: businessId, p_branch_id: branchId })
  );
}

export async function createSale({ businessId, branchId, customerId, items, payments, discountType, discountValue }) {
  return unwrap(
    await supabase.rpc("create_sale", {
      p_business_id: businessId,
      p_branch_id: branchId,
      p_customer_id: customerId || null,
      p_items: items,
      p_payments: payments,
      p_discount_type: discountType || "none",
      p_discount_value: discountValue || 0
    })
  );
}

export async function listSales(businessId) {
  return unwrap(
    await supabase
      .from("sales")
      .select("*, customers(name)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
  );
}

export async function getMySales(businessId) {
  return unwrap(await supabase.rpc("get_my_sales", { p_business_id: businessId }));
}

export async function getSaleItems(saleId) {
  return unwrap(
    await supabase.from("sale_items").select("*, products(name)").eq("sale_id", saleId)
  );
}

export async function voidSale(saleId, reason) {
  return unwrap(await supabase.rpc("void_sale", { p_sale_id: saleId, p_reason: reason }));
}

export async function createReturn(saleId, items, reason) {
  return unwrap(await supabase.rpc("create_return", { p_sale_id: saleId, p_items: items, p_reason: reason }));
}

// ---------- Purchases ----------

export async function listPurchases(businessId) {
  return unwrap(
    await supabase
      .from("purchases")
      .select("*, purchase_items(quantity, cost_price, subtotal, products(name))")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
  );
}

export async function createPurchase(businessId, branchId, items, purchaseDate) {
  return unwrap(
    await supabase.rpc("create_purchase", {
      p_business_id: businessId,
      p_branch_id: branchId,
      p_items: items,
      p_purchase_date: purchaseDate
    })
  );
}

// ---------- Expenses ----------

export async function listExpenses(businessId) {
  return unwrap(
    await supabase
      .from("expenses")
      .select("*")
      .eq("business_id", businessId)
      .order("expense_date", { ascending: false })
  );
}

export async function createExpense(businessId, branchId, expense) {
  return unwrap(
    await supabase.rpc("create_expense", {
      p_business_id: businessId,
      p_branch_id: branchId,
      p_category: expense.category,
      p_amount: expense.amount,
      p_description: expense.description || null,
      p_expense_date: expense.date
    })
  );
}

// ---------- Dashboard ----------

export async function getDashboardSummary(businessId, branchId) {
  return unwrap(
    await supabase.rpc("get_dashboard_summary", { p_business_id: businessId, p_branch_id: branchId })
  );
}

// ---------- Settings / Staff ----------

export async function getBusinessSettings(businessId) {
  return unwrap(
    await supabase.from("business_settings").select("*").eq("business_id", businessId).single()
  );
}

export async function updateBusinessSettings(businessId, patch) {
  return unwrap(
    await supabase.from("business_settings").update(patch).eq("business_id", businessId).select().single()
  );
}

export async function listMembers(businessId) {
  return unwrap(
    await supabase
      .from("business_members")
      .select("id, role, permissions, created_at, profiles(email, full_name)")
      .eq("business_id", businessId)
      .order("created_at")
  );
}

export async function addMember(businessId, email, role, permissions) {
  return unwrap(
    await supabase.rpc("add_business_member", {
      p_business_id: businessId,
      p_email: email,
      p_role: role,
      p_branch_id: null,
      p_permissions: permissions || {}
    })
  );
}

export async function updateManagerPermissions(memberId, permissions) {
  return unwrap(
    await supabase.rpc("update_manager_permissions", { p_member_id: memberId, p_permissions: permissions })
  );
}

export async function updateMemberRole(memberId, role) {
  return unwrap(await supabase.rpc("update_business_member_role", { p_member_id: memberId, p_role: role }));
}

export async function removeMember(memberId) {
  return unwrap(await supabase.rpc("remove_business_member", { p_member_id: memberId }));
}

export const MODULES = ["products", "inventory", "customers", "sales", "purchases", "expenses", "reports", "settings"];

// ---------- Product images (Supabase Storage) ----------

export async function uploadProductImage(businessId, file) {
  const ext = file.name.split(".").pop();
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

// ---------- Receipts ----------

export async function getSalePayments(saleId) {
  return unwrap(await supabase.from("payments").select("*").eq("sale_id", saleId));
}

export async function getSaleForReceipt(saleId) {
  return unwrap(
    await supabase
      .from("sales")
      .select("*, customers(name, phone)")
      .eq("id", saleId)
      .single()
  );
}
