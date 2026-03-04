const SUPABASE_URL = "https://ggcbglifxikslzfwffan.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnY2JnbGlmeGlrc2x6ZndmZmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTYyNDAsImV4cCI6MjA4ODIzMjI0MH0.wR0i-HFRvbimR3i9G3ACdIl7Ozs6nrm3QyVQiH7y9VA";
const CLOUD_TABLE = "kanban_state";
const STATE_ID = 1;

const STATUSES = [
  { key: "fazer", label: "Fazer", colorClass: "status-fazer" },
  { key: "fazendo", label: "Fazendo", colorClass: "status-fazendo" },
  { key: "parado", label: "Parado", colorClass: "status-parado" },
  { key: "feito", label: "Feito", colorClass: "status-feito" }
];

const THIRD_PARTY_KEY = "terceiros";

const INITIAL_COLUMNS = [
  { key: "joao", name: "João", fixed: false },
  { key: "paulo", name: "Paulo", fixed: false },
  { key: "alex", name: "Alex", fixed: false },
  { key: "nailson", name: "Nailson", fixed: false },
  { key: THIRD_PARTY_KEY, name: "Terceiros", fixed: true }
];

const INITIAL_OPS = [
  {
    id: crypto.randomUUID(),
    code: "00024",
    title: "Corte chapa A36",
    piece: "Suporte lateral",
    columnKey: "joao",
    statusKey: "fazendo"
  },
  {
    id: crypto.randomUUID(),
    code: "00031",
    title: "Furação conjunto B",
    piece: "Placa base",
    columnKey: "joao",
    statusKey: "fazer"
  },
  {
    id: crypto.randomUUID(),
    code: "05340",
    title: "Montagem final",
    piece: "Estrutura X",
    columnKey: "paulo",
    statusKey: "feito"
  },
  {
    id: crypto.randomUUID(),
    code: "07991",
    title: "Pintura eletrostática",
    piece: "Carcaça",
    columnKey: THIRD_PARTY_KEY,
    statusKey: "fazendo"
  }
];

let columns = structuredClone(INITIAL_COLUMNS);
let ops = structuredClone(INITIAL_OPS);
let editingOpId = null;
let draggedOpId = null;
let toastTimeout = null;
let saveQueue = Promise.resolve();

const board = document.getElementById("board");
const toast = document.getElementById("toast");
const opDialog = document.getElementById("opDialog");
const opDialogTitle = document.getElementById("opDialogTitle");
const opForm = document.getElementById("opForm");
const opCode = document.getElementById("opCode");
const opTitle = document.getElementById("opTitle");
const opPiece = document.getElementById("opPiece");
const opColumn = document.getElementById("opColumn");
const opStatus = document.getElementById("opStatus");
const saveOpBtn = document.getElementById("saveOpBtn");

const colDialog = document.getElementById("colDialog");
const colForm = document.getElementById("colForm");
const colName = document.getElementById("colName");

document.getElementById("newOpBtn").addEventListener("click", openNewOpDialog);
document.getElementById("newColBtn").addEventListener("click", () => colDialog.showModal());
document.getElementById("resetBtn").addEventListener("click", resetBoard);
document.getElementById("cancelOpBtn").addEventListener("click", () => opDialog.close());
document.getElementById("cancelColBtn").addEventListener("click", () => colDialog.close());

opForm.addEventListener("submit", onSubmitOpForm);
colForm.addEventListener("submit", onSubmitColumnForm);

init();

async function init() {
  await loadStateFromCloud();
  renderBoard();
}

function isCloudEnabled() {
  return (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("COLE_AQUI") &&
    !SUPABASE_ANON_KEY.includes("COLE_AQUI")
  );
}

function buildHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
  };
}

async function fetchCloudState() {
  const url = `${SUPABASE_URL}/rest/v1/${CLOUD_TABLE}?id=eq.${STATE_ID}&select=payload`;
  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders()
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar estado (${response.status})`);
  }

  const data = await response.json();
  return data[0]?.payload || null;
}

async function saveCloudState(payload) {
  const url = `${SUPABASE_URL}/rest/v1/${CLOUD_TABLE}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...buildHeaders(),
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([
      {
        id: STATE_ID,
        payload,
        updated_at: new Date().toISOString()
      }
    ])
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao salvar (${response.status}): ${body}`);
  }
}

function queuePersistState() {
  if (!isCloudEnabled()) return;

  const snapshot = {
    columns: structuredClone(columns),
    ops: structuredClone(ops)
  };

  saveQueue = saveQueue
    .then(() => saveCloudState(snapshot))
    .catch((error) => {
      console.error(error);
      showToast("Erro ao salvar na nuvem.");
    });
}

async function loadStateFromCloud() {
  if (!isCloudEnabled()) {
    showToast("Modo local: configure Supabase no app.js para salvar na nuvem.");
    return;
  }

  try {
    const payload = await fetchCloudState();

    if (!payload || !Array.isArray(payload.columns) || !Array.isArray(payload.ops)) {
      await saveCloudState({ columns: INITIAL_COLUMNS, ops: INITIAL_OPS });
      columns = structuredClone(INITIAL_COLUMNS);
      ops = structuredClone(INITIAL_OPS);
      showToast("Nuvem inicializada com dados de exemplo.");
      return;
    }

    columns = payload.columns;
    ops = payload.ops;
    showToast("Quadro carregado da nuvem.");
  } catch (error) {
    console.error(error);
    showToast("Falha ao conectar nuvem. Usando dados locais.");
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2600);
}

function canPlaceOp(opId, targetColumnKey, targetStatusKey) {
  if (targetStatusKey !== "fazendo") return true;
  if (targetColumnKey === THIRD_PARTY_KEY) return true;

  const makingInColumn = ops.filter(
    (op) => op.id !== opId && op.columnKey === targetColumnKey && op.statusKey === "fazendo"
  );

  return makingInColumn.length < 1;
}

function fillOpFormOptions() {
  opColumn.innerHTML = columns
    .map((column) => `<option value="${column.key}">${column.name}</option>`)
    .join("");

  opStatus.innerHTML = STATUSES.map(
    (status) => `<option value="${status.key}">${status.label}</option>`
  ).join("");
}

function openNewOpDialog() {
  editingOpId = null;
  opDialogTitle.textContent = "Nova OP";
  saveOpBtn.textContent = "Salvar";
  fillOpFormOptions();
  opForm.reset();
  opStatus.value = "fazer";
  if (columns.length > 0) opColumn.value = columns[0].key;
  opDialog.showModal();
}

function openEditOpDialog(opId) {
  const op = ops.find((item) => item.id === opId);
  if (!op) return;

  editingOpId = opId;
  opDialogTitle.textContent = "Editar OP";
  saveOpBtn.textContent = "Atualizar";
  fillOpFormOptions();

  opCode.value = op.code;
  opTitle.value = op.title;
  opPiece.value = op.piece;
  opColumn.value = op.columnKey;
  opStatus.value = op.statusKey;

  opDialog.showModal();
}

function onSubmitOpForm(event) {
  event.preventDefault();

  const formData = {
    code: opCode.value.trim(),
    title: opTitle.value.trim(),
    piece: opPiece.value.trim(),
    columnKey: opColumn.value,
    statusKey: opStatus.value
  };

  if (!formData.code || !formData.title || !formData.piece) {
    showToast("Preencha todos os campos da OP.");
    return;
  }

  const currentId = editingOpId || "";
  if (!canPlaceOp(currentId, formData.columnKey, formData.statusKey)) {
    showToast("Já existe 1 OP em Fazendo para esse funcionário.");
    return;
  }

  if (editingOpId) {
    ops = ops.map((op) => (op.id === editingOpId ? { ...op, ...formData } : op));
  } else {
    ops.push({ id: crypto.randomUUID(), ...formData });
  }

  opDialog.close();
  renderBoard();
  queuePersistState();
}

function onSubmitColumnForm(event) {
  event.preventDefault();
  const name = colName.value.trim();
  if (!name) return;

  const alreadyExists = columns.some((col) => col.name.toLowerCase() === name.toLowerCase());

  if (alreadyExists) {
    showToast("Já existe um funcionário com esse nome.");
    return;
  }

  const keyBase =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "funcionario";

  let key = keyBase;
  let i = 2;
  while (columns.some((col) => col.key === key)) {
    key = `${keyBase}-${i}`;
    i += 1;
  }

  const thirdParty = columns.find((col) => col.key === THIRD_PARTY_KEY);
  const withoutThirdParty = columns.filter((col) => col.key !== THIRD_PARTY_KEY);

  columns = [...withoutThirdParty, { key, name, fixed: false }, ...(thirdParty ? [thirdParty] : [])];

  colDialog.close();
  colForm.reset();
  renderBoard();
  queuePersistState();
}

function deleteColumn(columnKey) {
  const column = columns.find((col) => col.key === columnKey);
  if (!column || column.fixed) return;

  const hasCards = ops.some((op) => op.columnKey === columnKey);
  if (hasCards) {
    showToast("Não dá para excluir: existem OPs nessa coluna. Mova as OPs antes.");
    return;
  }

  if (!window.confirm(`Excluir a coluna ${column.name}?`)) return;

  columns = columns.filter((col) => col.key !== columnKey);
  renderBoard();
  queuePersistState();
}

function deleteOp(opId) {
  const op = ops.find((item) => item.id === opId);
  if (!op) return;

  if (!window.confirm(`Excluir OP ${op.code}?`)) return;
  ops = ops.filter((item) => item.id !== opId);
  renderBoard();
  queuePersistState();
}

function moveOp(opId, targetColumnKey, targetStatusKey) {
  const op = ops.find((item) => item.id === opId);
  if (!op) return;

  if (!canPlaceOp(opId, targetColumnKey, targetStatusKey)) {
    showToast("Já existe 1 OP em Fazendo para esse funcionário.");
    return;
  }

  op.columnKey = targetColumnKey;
  op.statusKey = targetStatusKey;
  renderBoard();
  queuePersistState();
}

function getOpsInCell(columnKey, statusKey) {
  return ops.filter((op) => op.columnKey === columnKey && op.statusKey === statusKey);
}

function resetBoard() {
  if (!window.confirm("Resetar o quadro para os dados iniciais?")) return;
  columns = structuredClone(INITIAL_COLUMNS);
  ops = structuredClone(INITIAL_OPS);
  renderBoard();
  queuePersistState();
}

function renderBoard() {
  const tableWrap = document.createElement("div");
  tableWrap.className = "board-table-wrap";

  const table = document.createElement("table");
  table.className = "board-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  const statusTh = document.createElement("th");
  statusTh.className = "status-header";
  statusTh.textContent = "Status \\ Responsável";
  headRow.appendChild(statusTh);

  columns.forEach((column) => {
    const th = document.createElement("th");
    th.className = "col-header";

    const top = document.createElement("div");
    top.className = "col-header-top";

    const name = document.createElement("span");
    name.textContent = column.name;

    top.appendChild(name);

    if (!column.fixed) {
      const delBtn = document.createElement("button");
      delBtn.className = "btn col-delete-btn";
      delBtn.textContent = "Excluir";
      delBtn.addEventListener("click", () => deleteColumn(column.key));
      top.appendChild(delBtn);
    }

    th.appendChild(top);
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  STATUSES.forEach((status) => {
    const row = document.createElement("tr");

    const statusCell = document.createElement("td");
    statusCell.className = `status-cell ${status.colorClass}`;
    statusCell.textContent = status.label;
    row.appendChild(statusCell);

    columns.forEach((column) => {
      const cell = document.createElement("td");

      const pocket = document.createElement("div");
      pocket.className = `pocket pocket-${status.key}`;
      pocket.dataset.columnKey = column.key;
      pocket.dataset.statusKey = status.key;

      const cards = getOpsInCell(column.key, status.key);

      const head = document.createElement("div");
      head.className = "pocket-head";

      const count = document.createElement("span");
      count.textContent = `${cards.length} OP`;
      head.appendChild(count);

      if (status.key === "fazendo") {
        const isThirdParty = column.key === THIRD_PARTY_KEY;
        const wip = document.createElement("span");
        wip.textContent = isThirdParty ? `WIP livre • ${cards.length}` : `WIP 1 • ${cards.length}/1`;
        head.appendChild(wip);
      }

      pocket.appendChild(head);

      const list = document.createElement("div");
      list.className = "card-list";

      cards.forEach((op) => {
        const card = document.createElement("article");
        card.className = "op-card";
        card.draggable = true;
        card.dataset.opId = op.id;

        card.addEventListener("dragstart", () => {
          draggedOpId = op.id;
          card.classList.add("dragging");
        });

        card.addEventListener("dragend", () => {
          draggedOpId = null;
          card.classList.remove("dragging");
        });

        const top = document.createElement("div");
        top.className = "op-top";

        const code = document.createElement("div");
        code.className = "op-code";
        code.textContent = `OP ${op.code}`;

        top.appendChild(code);
        card.appendChild(top);

        const title = document.createElement("div");
        title.className = "op-title";
        title.textContent = op.title;
        card.appendChild(title);

        const piece = document.createElement("div");
        piece.className = "op-piece";
        piece.textContent = `Peça: ${op.piece}`;
        card.appendChild(piece);

        const actions = document.createElement("div");
        actions.className = "op-actions";

        const editBtn = document.createElement("button");
        editBtn.className = "btn";
        editBtn.textContent = "Editar";
        editBtn.addEventListener("click", () => openEditOpDialog(op.id));

        const delBtn = document.createElement("button");
        delBtn.className = "btn btn-danger";
        delBtn.textContent = "Excluir";
        delBtn.addEventListener("click", () => deleteOp(op.id));

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        card.appendChild(actions);

        list.appendChild(card);
      });

      pocket.appendChild(list);

      pocket.addEventListener("dragover", (event) => {
        event.preventDefault();
        pocket.classList.add("drag-over");
      });

      pocket.addEventListener("dragleave", () => {
        pocket.classList.remove("drag-over");
      });

      pocket.addEventListener("drop", (event) => {
        event.preventDefault();
        pocket.classList.remove("drag-over");
        if (!draggedOpId) return;
        moveOp(draggedOpId, column.key, status.key);
      });

      cell.appendChild(pocket);
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);

  board.innerHTML = "";
  board.appendChild(tableWrap);
}
