import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, setDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCE_lxmrON0o2mHsj8olNaRIFKcgz6oQc8",
  authDomain: "matsucafe-cf8b4.firebaseapp.com",
  projectId: "matsucafe-cf8b4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = "gestao@matsu.com"; 
let products = []; let clients = []; let combos = []; let cart = []; let cartTotal = 0;
let currentDateFilterInicio = new Date().toISOString().split('T')[0];
let currentDateFilterFim = new Date().toISOString().split('T')[0];
let currentClientHistory = null;
let appConfig = { nome: "Matsucafe", cnpj: "", endereco: "", telefone: "", msg: "Obrigado e volte sempre!", logo: "", themeColor: "#14532d", backgroundImage: "", backgroundOpacity: 0.2, favicon: "./favicon.ico" };
let selectedThemeColor = '#14532d';
let productSalesEntries = [];

const tiposComVoucher = ['Colaborador', 'Colaborador Interno', 'Médico', 'Estagiário'];

// ==========================================
// TEMA E NAVEGAÇÃO
// ==========================================
function applyThemeColor(color) {
    const themeColor = color || '#14532d';
    selectedThemeColor = themeColor;
    const dynamicTheme = document.getElementById('dynamic-theme');
    if (dynamicTheme) {
        dynamicTheme.innerHTML = `:root { --theme-color: ${themeColor}; } .theme-bg { background-color: var(--theme-color) !important; } .theme-text { color: var(--theme-color) !important; } .theme-border { border-color: var(--theme-color) !important; } .theme-ring { box-shadow: 0 0 0 3px var(--theme-color) !important; }`;
    }
    const browserTheme = document.getElementById('meta-theme-color');
    if (browserTheme) browserTheme.setAttribute('content', themeColor);
    document.querySelectorAll('.theme-selector').forEach(btn => {
        btn.classList.toggle('ring-4', btn.dataset.color === themeColor);
        btn.classList.toggle('ring-offset-2', btn.dataset.color === themeColor);
        btn.classList.toggle('ring-gray-300', btn.dataset.color === themeColor);
    });
}

function applyBackgroundSettings(imageUrl, opacityValue) {
    const body = document.body;
    if (!body) return;
    const safeOpacity = Math.min(0.85, Math.max(0, Number(opacityValue || 0.2)));

    if (imageUrl) {
        const safeUrl = String(imageUrl).replace(/"/g, '%22');
        body.style.backgroundImage = `linear-gradient(rgba(255,255,255,${safeOpacity}), rgba(255,255,255,${safeOpacity})), url("${safeUrl}")`;
        body.style.backgroundSize = 'cover';
        body.style.backgroundPosition = 'center';
        body.style.backgroundRepeat = 'no-repeat';
        body.style.backgroundAttachment = 'fixed';
        body.classList.add('custom-bg-active');
    } else {
        body.style.backgroundImage = '';
        body.style.backgroundSize = '';
        body.style.backgroundPosition = '';
        body.style.backgroundRepeat = '';
        body.style.backgroundAttachment = '';
        body.classList.remove('custom-bg-active');
    }
}

function applyBrandingAssets() {
    const logo = appConfig.logo || 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=100&q=80';
    const sidebarLogo = document.getElementById('sidebar-logo');
    if (sidebarLogo) sidebarLogo.src = logo;
    const loginLogo = document.getElementById('login-logo');
    if (loginLogo) loginLogo.src = logo;
    const faviconHref = appConfig.favicon || appConfig.logo || './favicon.ico';
    const faviconEl = document.getElementById('app-favicon');
    if (faviconEl) faviconEl.setAttribute('href', faviconHref);
    const appleIconEl = document.getElementById('app-apple-touch-icon');
    if (appleIconEl) appleIconEl.setAttribute('href', appConfig.logo || faviconHref);
}

function formatCurrency(value = 0) {
    return `R$ ${Number(value || 0).toFixed(2)}`;
}

function normalizePaymentMethod(method = '') {
    const raw = String(method || '').trim();
    if (!raw) return 'Não informado';
    if (raw.toLowerCase().startsWith('voucher +')) {
        const complemento = raw.split('+')[1]?.trim();
        return complemento ? `Voucher + ${complemento}` : 'Voucher';
    }
    return raw;
}

document.querySelectorAll('.theme-selector').forEach(btn => {
    btn.onclick = () => {
        const color = btn.dataset.color;
        applyThemeColor(color);
    };
});

function switchTab(tabId) {
    document.querySelectorAll('main').forEach(m => m.classList.add('hidden'));
    const tab = document.getElementById(tabId);
    if(tab) tab.classList.remove('hidden');
}

['nav-pdv', 'nav-crm', 'nav-menu', 'nav-combos', 'nav-quebras', 'nav-financeiro', 'nav-settings'].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.addEventListener('click', () => switchTab(id.replace('nav-', 'tab-')));
});

const btnLogout = document.getElementById('btn-logout');
if(btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        const isAdmin = user.email === ADMIN_EMAIL;
        document.querySelectorAll('.admin-only').forEach(btn => btn.classList.toggle('hidden', !isAdmin));
        loadSettings(); loadProducts(); loadCombos(); loadCRM(); loadQuebras(); initDashboard();
    } else { document.getElementById('login-screen').style.display = 'flex'; }
});

const loginForm = document.getElementById('login-form');
if(loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value)
            .catch(() => document.getElementById('login-error').classList.remove('hidden'));
    });
}

// ==========================================
// CONFIGURAÇÕES
// ==========================================
function loadSettings() {
    onSnapshot(doc(db, "config", "loja"), (docSnap) => {
        if(docSnap.exists()) {
            appConfig = { ...appConfig, ...docSnap.data() };
        }
        selectedThemeColor = appConfig.themeColor || '#14532d';
        if(document.getElementById('cfg-nome')) document.getElementById('cfg-nome').value = appConfig.nome || '';
        if(document.getElementById('cfg-cnpj')) document.getElementById('cfg-cnpj').value = appConfig.cnpj || '';
        if(document.getElementById('cfg-endereco')) document.getElementById('cfg-endereco').value = appConfig.endereco || '';
        if(document.getElementById('cfg-telefone')) document.getElementById('cfg-telefone').value = appConfig.telefone || '';
        if(document.getElementById('cfg-msg')) document.getElementById('cfg-msg').value = appConfig.msg || '';
        if(document.getElementById('cfg-logo')) document.getElementById('cfg-logo').value = appConfig.logo || '';
        if(document.getElementById('cfg-favicon')) document.getElementById('cfg-favicon').value = appConfig.favicon || '';
        if(document.getElementById('cfg-bg-image')) document.getElementById('cfg-bg-image').value = appConfig.backgroundImage || '';
        if(document.getElementById('cfg-bg-opacity')) document.getElementById('cfg-bg-opacity').value = Number(appConfig.backgroundOpacity ?? 0.2);
        if(document.getElementById('cfg-bg-opacity-value')) document.getElementById('cfg-bg-opacity-value').innerText = `${Math.round(Number(appConfig.backgroundOpacity ?? 0.2) * 100)}%`;
        applyThemeColor(selectedThemeColor);
        applyBackgroundSettings(appConfig.backgroundImage || '', Number(appConfig.backgroundOpacity ?? 0.2));
        applyBrandingAssets();
    });
}

const cfgBgOpacity = document.getElementById('cfg-bg-opacity');
if (cfgBgOpacity) {
    cfgBgOpacity.addEventListener('input', (e) => {
        const opacity = Number(e.target.value || 0.2);
        const label = document.getElementById('cfg-bg-opacity-value');
        if (label) label.innerText = `${Math.round(opacity * 100)}%`;
        applyBackgroundSettings(document.getElementById('cfg-bg-image')?.value || '', opacity);
    });
}

const cfgBgImage = document.getElementById('cfg-bg-image');
if (cfgBgImage) {
    cfgBgImage.addEventListener('input', (e) => {
        applyBackgroundSettings(e.target.value || '', Number(document.getElementById('cfg-bg-opacity')?.value || 0.2));
    });
}

const cfgLogo = document.getElementById('cfg-logo');
if (cfgLogo) {
    cfgLogo.addEventListener('input', (e) => {
        appConfig.logo = e.target.value || '';
        applyBrandingAssets();
    });
}

const cfgFavicon = document.getElementById('cfg-favicon');
if (cfgFavicon) {
    cfgFavicon.addEventListener('input', (e) => {
        appConfig.favicon = e.target.value || './favicon.ico';
        applyBrandingAssets();
    });
}

const btnSaveCfg = document.getElementById('btn-save-cfg');
if(btnSaveCfg) {
    btnSaveCfg.onclick = async () => {
        const configPayload = {
            nome: document.getElementById('cfg-nome').value,
            cnpj: document.getElementById('cfg-cnpj').value,
            endereco: document.getElementById('cfg-endereco').value,
            telefone: document.getElementById('cfg-telefone').value,
            msg: document.getElementById('cfg-msg').value,
            logo: document.getElementById('cfg-logo').value,
            favicon: document.getElementById('cfg-favicon')?.value || './favicon.ico',
            themeColor: selectedThemeColor || '#14532d',
            backgroundImage: document.getElementById('cfg-bg-image')?.value || '',
            backgroundOpacity: Number(document.getElementById('cfg-bg-opacity')?.value || 0.2)
        };
        await setDoc(doc(db, "config", "loja"), configPayload, { merge: true });
        appConfig = { ...appConfig, ...configPayload };
        applyThemeColor(appConfig.themeColor);
        applyBackgroundSettings(appConfig.backgroundImage, appConfig.backgroundOpacity);
        applyBrandingAssets();
        alert("Configurações salvas com sucesso!");
    };
}

// ==========================================
// CRM
// ==========================================
function loadCRM() {
    onSnapshot(collection(db, "clientes"), (snapshot) => {
        clients = []; snapshot.forEach(d => clients.push({ id: d.id, ...d.data() }));
        renderCRM(); updatePDVClients();
    });
}

function updatePDVClients() {
    const pdvSelect = document.getElementById('pdv-cliente');
    if(!pdvSelect) return;
    pdvSelect.innerHTML = '<option value="Avulso">Cliente Avulso</option>';
    clients.forEach(c => pdvSelect.innerHTML += `<option value="${c.nome}">${c.nome} (${c.tipo})</option>`);
}

const pdvClienteSelect = document.getElementById('pdv-cliente');
if(pdvClienteSelect) {
    pdvClienteSelect.addEventListener('change', (e) => {
        const nome = e.target.value;
        const c = clients.find(cli => cli.nome === nome);
        const infoDiv = document.getElementById('pdv-voucher-info');
        if(c && tiposComVoucher.includes(c.tipo)) {
            const saldo = parseFloat(c.saldo_voucher !== undefined ? c.saldo_voucher : c.voucher || 0);
            document.getElementById('pdv-voucher-saldo').innerText = `R$ ${saldo.toFixed(2)}`;
            infoDiv.classList.remove('hidden');
        } else { infoDiv.classList.add('hidden'); }
    });
}

function renderCRM(searchTerm = '') {
    const list = document.getElementById('crm-list'); if(!list) return;
    list.innerHTML = '';
    const filtered = clients.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    
    filtered.forEach(c => {
        const isColab = tiposComVoucher.includes(c.tipo);
        const limiteReal = parseFloat(c.voucher || 0).toFixed(2);
        const saldoReal = parseFloat(c.saldo_voucher !== undefined ? c.saldo_voucher : c.voucher || 0).toFixed(2);
        
        let limitInfo = '';
        if (isColab) {
            if (c.tipo === 'Estagiário') {
                limitInfo = `<br><span class="text-[10px] text-green-700 font-bold bg-green-50 px-2 py-1 rounded-md border border-green-200 mt-1 inline-block">Saldo: R$ ${saldoReal}</span>`;
            } else {
                limitInfo = `<br><span class="text-[10px] text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded-md border border-purple-100 mt-1 inline-block">Limite: R$ ${limiteReal} | Restante: R$ ${saldoReal}</span>`;
            }
        }

        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer";
        tr.innerHTML = `
            <td class="p-4 font-black text-gray-800 uppercase" onclick="window.openHistoryModal('${c.nome}')">${c.nome}</td>
            <td class="p-4" onclick="window.openHistoryModal('${c.nome}')"><span class="${isColab ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'} px-3 py-1 rounded-lg text-xs font-black shadow-sm">${c.tipo}</span>${limitInfo}</td>
            <td class="p-4 text-gray-500 font-bold" onclick="window.openHistoryModal('${c.nome}')">${c.telefone || '---'}</td>
            <td class="p-4 text-right flex justify-end gap-2">
                <button class="bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-edit"><i class="ph ph-pencil-simple text-lg"></i></button>
                <button class="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-del"><i class="ph ph-trash text-lg"></i></button>
            </td>
        `;
        tr.querySelector('.btn-edit').onclick = () => window.openClientModal(c);
        tr.querySelector('.btn-del').onclick = async () => { if(confirm('Excluir contato?')) await deleteDoc(doc(db, "clientes", c.id)); };
        list.appendChild(tr);
    });
}

const searchCliente = document.getElementById('search-cliente');
if(searchCliente) searchCliente.addEventListener('input', (e) => renderCRM(e.target.value));

const btnSaveClient = document.getElementById('btn-save-client');
if(btnSaveClient) {
    btnSaveClient.onclick = async () => {
        const id = document.getElementById('cli-id').value;
        const tipoSelecionado = document.getElementById('cli-tipo').value;
        const isColab = tiposComVoucher.includes(tipoSelecionado);
        
        const valorVoucher = parseFloat(document.getElementById('cli-voucher').value || 0); 
        const inputSaldo = document.getElementById('cli-saldo-voucher').value; 
        const addSaldo = parseFloat(document.getElementById('cli-add-saldo').value || 0); 
        
        let valorSaldoAtual = inputSaldo !== '' ? parseFloat(inputSaldo) : valorVoucher;
        valorSaldoAtual += addSaldo;

        const data = {
            nome: document.getElementById('cli-nome').value, 
            telefone: document.getElementById('cli-telefone').value,
            tipo: tipoSelecionado, 
            voucher: isColab ? valorVoucher : 0,
            saldo_voucher: isColab ? valorSaldoAtual : 0
        };

        if(id) await updateDoc(doc(db, "clientes", id), data); 
        else await addDoc(collection(db, "clientes"), data);
        window.closeModals();
    };
}

// ==========================================
// HISTÓRICO COM EXTRATO
// ==========================================
window.loadClientHistory = async () => {
    if(!currentClientHistory) return;
    const inicio = document.getElementById('hist-data-inicio').value;
    const fim = document.getElementById('hist-data-fim').value;
    const q = query(collection(db, "vendas"), where("cliente", "==", currentClientHistory));
    const snap = await getDocs(q);
    
    let total = 0; const lista = document.getElementById('hist-lista'); 
    if(!lista) return;
    lista.innerHTML = '';
    
    snap.forEach(doc => {
        const v = doc.data();
        if(inicio && fim && (v.dataSimples < inicio || v.dataSimples > fim)) return; 
        
        total += v.total;

        let itensStr = '';
        if(v.itens) {
            v.itens.forEach(i => {
                const qtde = i.qty || i.qtd || 1;
                itensStr += `<p class="text-xs text-gray-600 ml-2">- ${qtde}x ${i.nome} (R$ ${(i.preco * qtde).toFixed(2)})</p>`;
            });
        }

        lista.innerHTML += `
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm shadow-sm flex flex-col gap-2">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-black text-gray-800">Pedido #${v.nroPedido}</p>
                        <p class="text-xs text-gray-500 font-bold mt-1">${v.dataSimples.split('-').reverse().join('/')} - Pgto: ${v.pagamento}</p>
                    </div>
                    <div class="font-black text-green-600 text-lg">R$ ${v.total.toFixed(2)}</div>
                </div>
                ${itensStr ? `
                <div class="mt-2 border-t pt-2 border-gray-200">
                    <p class="text-[10px] font-black text-gray-400 uppercase mb-1">Itens consumidos:</p>
                    ${itensStr}
                </div>` : ''}
            </div>
        `;
    });
    document.getElementById('hist-total').innerText = `R$ ${total.toFixed(2)}`;
    if(lista.innerHTML === '') lista.innerHTML = '<p class="text-gray-400 text-center text-sm p-4 font-bold">Nenhuma compra encontrada no período.</p>';
};

window.printClientHistory = async () => {
    if(!currentClientHistory) return;
    const inicio = document.getElementById('hist-data-inicio').value;
    const fim = document.getElementById('hist-data-fim').value;
    const q = query(collection(db, "vendas"), where("cliente", "==", currentClientHistory));
    const snap = await getDocs(q);

    let total = 0; let reportHtml = '';

    snap.forEach(doc => {
        const v = doc.data();
        if(inicio && fim && (v.dataSimples < inicio || v.dataSimples > fim)) return;
        total += v.total;

        let itemsHtml = '';
        if(v.itens) {
            v.itens.forEach(i => {
                const qtde = i.qty || i.qtd || 1;
                itemsHtml += `<div style="display:flex; justify-content:space-between; font-size:11px; margin-left:5px; color:#333;"><span>- ${qtde}x ${i.nome}</span><span>R$ ${(i.preco * qtde).toFixed(2)}</span></div>`;
            });
        }

        reportHtml += `
            <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #ccc;">
                <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; margin-bottom: 3px;">
                    <span>#${v.nroPedido} (${v.dataSimples.split('-').reverse().join('/')})</span>
                    <span>R$ ${v.total.toFixed(2)}</span>
                </div>
                <div style="font-size: 10px; margin-bottom: 4px; color: #666;">Pgto: ${v.pagamento}</div>
                ${itemsHtml}
            </div>
        `;
    });

    const logoHtml = appConfig.logo ? `<img src="${appConfig.logo}" class="receipt-logo">` : '';
    const printSec = document.getElementById('print-section');
    if(printSec) {
        printSec.innerHTML = `
            <div class="receipt-header">
                ${logoHtml}
                <h2 class="receipt-title">${appConfig.nome || 'Matsucafe'}</h2>
            </div>
            <div class="receipt-divider"></div>
            <div style="text-align: center;">
                <p class="receipt-info" style="font-weight:bold; font-size: 14px;">EXTRATO DE CONSUMO</p>
                <p class="receipt-info" style="font-weight:bold; font-size: 14px;">${currentClientHistory}</p>
                ${(inicio && fim) ? `<p class="receipt-info" style="font-size: 10px;">Período: ${inicio.split('-').reverse().join('/')} a ${fim.split('-').reverse().join('/')}</p>` : ''}
            </div>
            <div class="receipt-divider"></div>
            ${reportHtml || '<p style="text-align:center; font-size:12px;">Nenhum consumo no período.</p>'}
            <div class="receipt-total"><span>TOTAL GASTO:</span><span>R$ ${total.toFixed(2)}</span></div>
            <div class="receipt-footer"><p style="margin-top: 40px;">___________________________________</p><p style="font-weight: bold; margin-top:5px;">ASSINATURA</p></div><br>
        `;
        setTimeout(() => { window.print(); }, 300);
    }
};

// ==========================================
// ESTOQUE COM LOTES 
// ==========================================
async function loadProducts() {
    onSnapshot(collection(db, "produtos"), (snapshot) => {
        products = []; 
        const quebraSelect = document.getElementById('quebra-produto');
        if(quebraSelect) quebraSelect.innerHTML = '<option value="">Selecione o Produto</option>';
        
        snapshot.forEach((docSnap) => {
            const p = { id: docSnap.id, ...docSnap.data() }; 
            if(p.estoque !== undefined && !p.lotes) {
                p.estoque_total = p.estoque;
                p.lotes = [{ id_lote: Date.now().toString(), quantidade: p.estoque, data_entrada: p.validade || '-', validade: p.validade || '', tipo: 'unidade' }];
            }
            products.push(p);
            const totalEstoque = (p.lotes || []).reduce((acc, lote) => acc + lote.quantidade, 0);
            if(quebraSelect) quebraSelect.innerHTML += `<option value="${p.id}">${p.nome} (${totalEstoque} disp.)</option>`;
        });
        window.renderAdminProducts(); buildCategoryTabs();
    });
}

window.renderAdminProducts = (searchTerm = '') => {
    const list = document.getElementById('admin-product-list'); if(!list) return;
    list.innerHTML = '';
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const filtered = products.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()));

    filtered.forEach(p => {
        const totalEstoque = (p.lotes || []).reduce((acc, lote) => acc + lote.quantidade, 0);
        const lotesComEstoque = (p.lotes || []).filter(l => l.quantidade > 0 && l.validade);
        lotesComEstoque.sort((a, b) => new Date(a.validade) - new Date(b.validade));
        const loteMaisProximo = lotesComEstoque[0];

        let statusVencimentoHtml = '<span class="text-gray-400">Sem validade</span>';
        if (loteMaisProximo) {
            const dataValidade = new Date(loteMaisProximo.validade); dataValidade.setHours(0,0,0,0);
            const diffDias = Math.ceil((dataValidade.getTime() - hoje.getTime()) / (1000 * 3600 * 24));
            const dataFormatada = loteMaisProximo.validade.split('-').reverse().join('/');

            if (diffDias < 0) statusVencimentoHtml = `<span class="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-black animate-pulse shadow-sm">VENCIDO (${dataFormatada})</span>`;
            else if (diffDias <= 7) statusVencimentoHtml = `<span class="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-xs font-black shadow-sm">Alerta: ${diffDias} dias (${dataFormatada})</span>`;
            else if (diffDias <= 30) statusVencimentoHtml = `<span class="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg text-xs font-bold shadow-sm">Vence em ${diffDias} dias</span>`;
            else statusVencimentoHtml = `<span class="text-green-600 font-bold">${dataFormatada}</span>`;
        }

        const tr = document.createElement('tr'); 
        tr.className = "border-b border-gray-50 hover:bg-gray-50 transition";
        tr.innerHTML = `
            <td class="p-4 flex items-center gap-3"><img src="${p.imagem}" class="w-12 h-12 rounded-xl object-contain bg-white shadow-sm border border-gray-100 p-1">
                <div><span class="font-black text-gray-800 block">${p.nome}</span><span class="text-[10px] text-gray-400 font-bold uppercase">${(p.lotes || []).length} lote(s)</span></div>
            </td>
            <td class="p-4"><span class="bg-gray-100 px-3 py-1 rounded-lg text-xs font-bold border border-gray-200">${p.categoria}</span></td>
            <td class="p-4 font-black text-lg ${totalEstoque <= 5 ? 'text-red-500' : 'text-blue-600'}">${totalEstoque} un</td>
            <td class="p-4">${statusVencimentoHtml}</td>
            <td class="p-4 text-right flex justify-end gap-2">
                <button class="bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-add-lote" title="Add Lote/Editar"><i class="ph ph-pencil-simple text-lg"></i></button> 
                <button class="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-del"><i class="ph ph-trash text-lg"></i></button>
            </td>
        `;
        tr.querySelector('.btn-add-lote').onclick = () => window.openProductModal(p);
        tr.querySelector('.btn-del').onclick = async () => { if(confirm('Excluir produto e lotes permanentemente?')) await deleteDoc(doc(db, "produtos", p.id)); };
        list.appendChild(tr); 
    });
};

const searchEstoqueInput = document.getElementById('search-estoque');
if(searchEstoqueInput) searchEstoqueInput.addEventListener('input', (e) => window.renderAdminProducts(e.target.value));

const btnSaveProduct = document.getElementById('btn-save-product');
if(btnSaveProduct) {
    btnSaveProduct.onclick = async () => {
        const id = document.getElementById('edit-id').value;
        const nomeProduto = document.getElementById('prod-nome').value.trim();
        const qtdLote = parseInt(document.getElementById('prod-estoque-lote').value || 0);
        
        if(!nomeProduto) return alert("O nome do produto é obrigatório!");

        const novoLote = { id_lote: `lote_${Date.now()}`, tipo: document.getElementById('prod-tipo-lote').value, quantidade: qtdLote, data_entrada: document.getElementById('prod-entrada').value || new Date().toISOString().split('T')[0], validade: document.getElementById('prod-validade').value };
        const dadosBaseProduto = { nome: nomeProduto, categoria: document.getElementById('prod-categoria').value || 'Geral', preco: parseFloat(document.getElementById('prod-venda').value || 0), custo: parseFloat(document.getElementById('prod-custo').value || 0), imagem: document.getElementById('prod-imagem').value || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=300&q=80' };

        if (id) {
            const produtoAtual = products.find(p => p.id === id);
            let lotesAtuais = produtoAtual.lotes || [];
            if (qtdLote > 0) lotesAtuais.push(novoLote);
            const estoque_total = lotesAtuais.reduce((acc, l) => acc + l.quantidade, 0);
            await updateDoc(doc(db, "produtos", id), { ...dadosBaseProduto, lotes: lotesAtuais, estoque_total: estoque_total });
        } else {
            await addDoc(collection(db, "produtos"), { ...dadosBaseProduto, lotes: qtdLote > 0 ? [novoLote] : [], estoque_total: qtdLote });
        }
        window.closeModals();
    };
}

// ==========================================
// COMBOS E QUEBRAS
// ==========================================
async function loadCombos() {
    onSnapshot(collection(db, "combos"), (snapshot) => {
        combos = []; const list = document.getElementById('combos-list'); if(!list) return;
        list.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const c = { id: docSnap.id, ...docSnap.data() }; combos.push(c);
            const itemsText = c.itens.map(i => `${i.nome}`).join(' + ');
            const imgHtml = c.imagem ? `<img src="${c.imagem}" class="w-14 h-14 rounded-xl object-contain border border-gray-100 p-1 mr-4 bg-gray-50 shadow-sm">` : '';
            
            const div = document.createElement('div');
            div.className = "p-5 border border-gray-100 rounded-2xl flex justify-between items-center hover:shadow-lg transition bg-white shadow-sm";
            div.innerHTML = `
                <div class="flex items-center">${imgHtml}<div><h4 class="font-black text-gray-800 text-lg">${c.nome}</h4><p class="text-xs text-gray-500 font-bold uppercase mt-1">${itemsText}</p><p class="text-green-600 font-black mt-2 text-xl">R$ ${c.preco.toFixed(2)}</p></div></div>
                <button class="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-del"><i class="ph ph-trash text-xl"></i></button>
            `;
            div.querySelector('.btn-del').onclick = async () => { if(confirm('Excluir Combo?')) await deleteDoc(doc(db, "combos", c.id)); };
            list.appendChild(div);
        });
        buildCategoryTabs();
    });
}

const btnSaveCombo = document.getElementById('btn-save-combo');
if(btnSaveCombo) {
    btnSaveCombo.onclick = async () => {
        const nome = document.getElementById('combo-nome').value;
        const imagem = document.getElementById('combo-imagem').value; 
        const preco = parseFloat(document.getElementById('combo-preco').value || 0);
        const checkboxes = document.querySelectorAll('.combo-prod-check:checked');
        if(!nome || preco <= 0 || checkboxes.length === 0) return alert('Preencha nome, preço e selecione produtos!');
        const itensSelecionados = Array.from(checkboxes).map(cb => { const prod = products.find(p => p.id === cb.value); return { id: prod.id, nome: prod.nome, custo: prod.custo }; });
        await addDoc(collection(db, "combos"), { nome, imagem, preco, itens: itensSelecionados, isCombo: true });
        window.closeModals();
    };
}

async function loadQuebras() {
    onSnapshot(collection(db, "quebras"), (snapshot) => {
        const list = document.getElementById('quebra-list'); if(!list) return;
        list.innerHTML = '';
        snapshot.forEach(docSnap => {
            const q = docSnap.data(); const div = document.createElement('div');
            div.className = "bg-white p-4 rounded-2xl flex justify-between items-center border border-red-100 shadow-sm";
            div.innerHTML = `<div><p class="font-black text-red-600 uppercase">${q.produtoNome} x${q.qtd}</p><p class="text-xs font-bold text-gray-500 mt-1">${q.motivo} | Perda: R$ ${(q.valorPerda || 0).toFixed(2)}</p></div><button class="bg-gray-100 hover:bg-red-500 hover:text-white transition text-gray-400 p-3 rounded-xl shadow-sm btn-del"><i class="ph ph-trash text-lg"></i></button>`;
            div.querySelector('.btn-del').onclick = async () => { if(confirm('Apagar registro?')) await deleteDoc(doc(db, "quebras", docSnap.id)); };
            list.appendChild(div);
        });
    });
}

const btnAddQuebra = document.getElementById('btn-add-quebra');
if(btnAddQuebra) {
    btnAddQuebra.onclick = async () => {
        const pId = document.getElementById('quebra-produto').value; 
        const qty = parseInt(document.getElementById('quebra-qty').value);
        const p = products.find(prod => prod.id === pId);
        if(!p || !qty) return alert("Preencha corretamente!");
        const estoqueAtual = p.estoque_total !== undefined ? p.estoque_total : p.estoque;
        if(qty > estoqueAtual) return alert("Quantidade maior que o estoque!");
        await addDoc(collection(db, "quebras"), { produtoId: pId, produtoNome: p.nome, qtd: qty, motivo: document.getElementById('quebra-motivo').value || '-', valorPerda: p.custo * qty, data: serverTimestamp(), dataSimples: new Date().toISOString().split('T')[0] });
        await baixarEstoqueFIFO(p.id, qty);
        document.getElementById('quebra-qty').value = ''; document.getElementById('quebra-motivo').value = '';
        alert("Quebra registrada e estoque deduzido!");
    };
}

// ==========================================
// ESTORNO MANUAL E ESTOQUE FIFO
// ==========================================
window.processarEstornoManual = async (nomeProd, qtde) => {
    const pQuery = query(collection(db, "produtos"), where("nome", "==", nomeProd));
    const pSnap = await getDocs(pQuery);
    if (!pSnap.empty) {
        const pDoc = pSnap.docs[0];
        const pData = pDoc.data();
        let lotesAtuais = pData.lotes || [];
        lotesAtuais.push({
            id_lote: `estorno_${Date.now()}`,
            tipo: 'Devolução de Venda',
            quantidade: qtde,
            data_entrada: new Date().toISOString().split('T')[0],
            validade: '' 
        });
        const novoEstoqueTotal = lotesAtuais.reduce((acc, l) => acc + l.quantidade, 0);
        await updateDoc(doc(db, "produtos", pDoc.id), { lotes: lotesAtuais, estoque_total: novoEstoqueTotal });
    }
};

async function baixarEstoqueFIFO(produtoId, quantidadeParaBaixar) {
    const p = products.find(prod => prod.id === produtoId);
    if(!p) return;
    let lotesAtuais = p.lotes || []; let qtdRestante = quantidadeParaBaixar;
    lotesAtuais.sort((a, b) => new Date(a.validade) - new Date(b.validade));
    for (let lote of lotesAtuais) {
        if (qtdRestante <= 0) break;
        if (lote.quantidade > 0) {
            if (lote.quantidade >= qtdRestante) { lote.quantidade -= qtdRestante; qtdRestante = 0; } 
            else { qtdRestante -= lote.quantidade; lote.quantidade = 0; }
        }
    }
    const novoEstoqueTotal = lotesAtuais.reduce((acc, l) => acc + l.quantidade, 0);
    await updateDoc(doc(db, "produtos", p.id), { lotes: lotesAtuais, estoque_total: novoEstoqueTotal });
}

// ==========================================
// FINANCEIRO, HORA E REMOÇÃO DE ITEM DO PEDIDO
// ==========================================
const filtroDataInicio = document.getElementById('filtro-data-inicio');
const filtroDataFim = document.getElementById('filtro-data-fim');
if(filtroDataInicio && filtroDataFim) { 
    filtroDataInicio.value = currentDateFilterInicio; 
    filtroDataFim.value = currentDateFilterFim; 
    filtroDataInicio.onchange = (e) => { currentDateFilterInicio = e.target.value; initDashboard(); };
    filtroDataFim.onchange = (e) => { currentDateFilterFim = e.target.value; initDashboard(); };
}

// Funções globais para manipulação de Vouchers
window.baixaVoucher = async (id, colaborador, valor, nroPedido) => {
    if(confirm(`Confirmar o RECEBIMENTO FINANCEIRO de R$ ${valor.toFixed(2)} referente a ${colaborador}?\n\nO valor entrará no faturamento de HOJE.`)) {
        await updateDoc(doc(db, "vouchers_pendentes", id), { status: 'pago', dataPagamento: new Date().toISOString() });
        
        const nroPagamento = Math.floor(1000 + Math.random() * 9000);
        await addDoc(collection(db, "vendas"), {
            nroPedido: `PGTO-${nroPagamento}`, 
            total: parseFloat(valor), 
            custoTotal: 0, 
            cliente: colaborador, 
            pagamento: 'Recebimento Voucher', 
            cpf: '', 
            complemento: 0, 
            isVoucherPgto: true,
            data: serverTimestamp(), 
            dataSimples: new Date().toISOString().split('T')[0], 
            itens: [{nome: `Pgto Voucher (Ref. #${nroPedido})`, qty: 1, preco: parseFloat(valor)}]
        });
        
        alert('Baixa realizada com sucesso! O valor já subiu no faturamento de hoje.');
    }
};

window.baixaTodosVouchers = async (colaborador) => {
    if(confirm(`Confirmar o RECEBIMENTO FINANCEIRO de TODOS os vouchers pendentes de ${colaborador}?`)) {
        const pendQuery = query(collection(db, "vouchers_pendentes"), where("colaborador", "==", colaborador), where("status", "==", "pendente"));
        const pendSnap = await getDocs(pendQuery);
        
        let valorTotal = 0;
        
        pendSnap.forEach(async (docSnap) => {
            const pendData = docSnap.data();
            valorTotal += pendData.valor;
            await updateDoc(doc(db, "vouchers_pendentes", docSnap.id), { status: 'pago', dataPagamento: new Date().toISOString() });
        });
        
        if(valorTotal > 0) {
            const nroPagamento = Math.floor(1000 + Math.random() * 9000);
            await addDoc(collection(db, "vendas"), {
                nroPedido: `PGTO-${nroPagamento}`, 
                total: parseFloat(valorTotal), 
                custoTotal: 0, 
                cliente: colaborador, 
                pagamento: 'Recebimento Voucher', 
                cpf: '', 
                complemento: 0, 
                isVoucherPgto: true,
                data: serverTimestamp(), 
                dataSimples: new Date().toISOString().split('T')[0], 
                itens: [{nome: `Pgto Múltiplo de Vouchers`, qty: 1, preco: parseFloat(valorTotal)}]
            });
        }
        
        alert('Baixa de todos os pedidos realizada com sucesso! Faturamento atualizado.');
    }
};

window.editVoucher = async (docId, colaborador, nroPedido, valorRestaurar) => {
    const novoPgto = prompt(`Lançamento atual: VOUCHER PENDENTE\n\nSe o cliente NÃO pagou com voucher e houve um erro na frente de caixa, digite a forma correta que ele pagou (Ex: PIX, Crédito, Dinheiro):`);
    if(novoPgto && novoPgto.trim() !== "" && !novoPgto.toLowerCase().includes('voucher')) {
        if(confirm(`Mudar este lançamento para ${novoPgto.trim().toUpperCase()}?\n\n- O limite de voucher dele será devolvido.\n- A venda ficará como Cliente Avulso na lista principal.`)) {
            const c = clients.find(cli => cli.nome === colaborador);
            if(c) {
                const novoSaldo = parseFloat(c.saldo_voucher || 0) + parseFloat(valorRestaurar);
                await updateDoc(doc(db, "clientes", c.id), { saldo_voucher: novoSaldo });
            }
            const vQuery = query(collection(db, "vendas"), where("nroPedido", "==", nroPedido));
            const vSnap = await getDocs(vQuery);
            if(!vSnap.empty) {
                const vendaRef = vSnap.docs[0];
                await updateDoc(doc(db, "vendas", vendaRef.id), { pagamento: novoPgto.trim(), cliente: "Cliente Avulso" });
            }
            await deleteDoc(doc(db, "vouchers_pendentes", docId));
            alert("Lançamento corrigido com sucesso! O limite retornou para o colaborador.");
        }
    }
};

window.printVouchersReport = async () => {
    const dataInicio = document.getElementById('filtro-data-inicio').value;
    const dataFim = document.getElementById('filtro-data-fim').value;

    const statusFiltro = prompt("Qual relatório deseja imprimir?\n1 - Apenas Vouchers Pendentes (A Receber)\n2 - Apenas Vouchers Pagos (Já Recebidos)\n3 - Geral (Todos os Status)", "1");
    if (!statusFiltro) return; 

    let statusCheck = ['pendente'];
    if (statusFiltro === "2") statusCheck = ['pago'];
    if (statusFiltro === "3") statusCheck = ['pendente', 'pago'];

    const vQuery = collection(db, "vouchers_pendentes");
    const vSnap = await getDocs(vQuery);
    
    let reportHtml = '';
    let totalReport = 0;
    let count = 0;
    
    const listVouchers = [];
    vSnap.forEach(docSnap => {
        const pend = docSnap.data();
        if (pend.dataStr >= dataInicio && pend.dataStr <= dataFim && statusCheck.includes(pend.status)) {
            listVouchers.push(pend);
        }
    });

    const byColab = {};
    listVouchers.forEach(v => {
        if(!byColab[v.colaborador]) byColab[v.colaborador] = { total: 0, items: [] };
        byColab[v.colaborador].total += v.valor;
        byColab[v.colaborador].items.push(v);
        totalReport += v.valor;
        count++;
    });

    for (const colab in byColab) {
        reportHtml += `<div style="margin-bottom: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 8px;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">${colab} <span style="float:right">Total: R$ ${byColab[colab].total.toFixed(2)}</span></div>`;
        byColab[colab].items.forEach(item => {
            let horaStrPend = '';
            if (item.timestamp && typeof item.timestamp.toDate === 'function') {
                horaStrPend = item.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }
            reportHtml += `<div style="display: flex; justify-content: space-between; font-size: 12px; margin-left: 10px; margin-bottom: 3px; color: #333;">
                <span>${item.dataStr.split('-').reverse().join('/')} ${horaStrPend} | #${item.nroPedido} | ${item.status.toUpperCase()}</span>
                <span>R$ ${item.valor.toFixed(2)}</span>
            </div>`;
        });
        reportHtml += `</div>`;
    }

    if(count === 0) reportHtml = '<p style="text-align:center; font-size:12px; margin-top:20px;">Nenhum voucher encontrado neste período com esse status.</p>';

    let nomeStatus = "PENDENTES A RECEBER";
    if (statusFiltro === "2") nomeStatus = "PAGOS / RECEBIDOS";
    if (statusFiltro === "3") nomeStatus = "GERAL (TODOS)";

    const logoHtml = appConfig.logo ? `<img src="${appConfig.logo}" class="receipt-logo">` : '';
    const printSec = document.getElementById('print-section');
    if(printSec) {
        printSec.innerHTML = `
            <div class="receipt-header">
                ${logoHtml}
                <h2 class="receipt-title">${appConfig.nome || 'Matsucafe'}</h2>
            </div>
            <div class="receipt-divider"></div>
            <div style="text-align: center;">
                <p class="receipt-info" style="font-weight:bold; font-size: 14px;">RELATÓRIO DE VOUCHERS</p>
                <p class="receipt-info" style="font-weight:bold; font-size: 12px; color: #555;">Status: ${nomeStatus}</p>
                <p class="receipt-info" style="font-size: 11px;">Período: ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}</p>
            </div>
            <div class="receipt-divider"></div>
            ${reportHtml}
            <div class="receipt-total" style="margin-top: 15px;"><span>TOTAL DO RELATÓRIO:</span><span>R$ ${totalReport.toFixed(2)}</span></div>
            <div class="receipt-footer"><p style="margin-top: 40px;">___________________________________</p><p style="font-weight: bold; margin-top:5px;">ASSINATURA FINANCEIRO</p></div><br>
        `;
        setTimeout(() => { window.print(); }, 300);
    }
};

function initDashboard() {
    window.dailyPaymentTotals = {};

    onSnapshot(collection(db, "vendas"), (snapVendas) => {
        onSnapshot(collection(db, "vouchers_pendentes"), (snapVouchers) => {
            let totalVendas = 0; let totalCusto = 0; let pendenteTotal = 0;
            const history = document.getElementById('sales-history-list'); 
            const vouchersList = document.getElementById('vouchers-history-list'); 
            
            if(history) history.innerHTML = ''; if(vouchersList) vouchersList.innerHTML = '';
            window.dailyPaymentTotals = {}; 
            const productSalesMap = new Map();

            // VENDAS REALIZADAS (LADO ESQUERDO)
            snapVendas.forEach(docSnap => {
                const v = docSnap.data();
                if(v.dataSimples >= currentDateFilterInicio && v.dataSimples <= currentDateFilterFim) {
                    totalVendas += v.total; totalCusto += v.custoTotal || 0; 
                    
                    let metodo = normalizePaymentMethod(v.pagamento);
                    if (v.complemento > 0 && metodo.includes('Voucher +')) {
                        let compMethod = metodo.split('+')[1].trim();
                        window.dailyPaymentTotals['Voucher'] = (window.dailyPaymentTotals['Voucher'] || 0) + (v.total - v.complemento);
                        window.dailyPaymentTotals[compMethod] = (window.dailyPaymentTotals[compMethod] || 0) + v.complemento;
                    } else {
                        window.dailyPaymentTotals[metodo] = (window.dailyPaymentTotals[metodo] || 0) + v.total;
                    }
                    
                    if (Array.isArray(v.itens)) {
                        v.itens.forEach(item => {
                            const nomeItem = item.nome || 'Item sem nome';
                            const quantidadeItem = Number(item.qty || item.qtd || 1);
                            const precoItem = Number(item.preco || 0);
                            if (!productSalesMap.has(nomeItem)) productSalesMap.set(nomeItem, { name: nomeItem, qty: 0, revenue: 0, cost: 0 });
                            const resumoItem = productSalesMap.get(nomeItem);
                            resumoItem.qty += quantidadeItem;
                            resumoItem.revenue += precoItem * quantidadeItem;
                        });
                    }

                    let horaStr = '';
                    if (v.data && typeof v.data.toDate === 'function') {
                        horaStr = v.data.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    }

                    if(history) {
                        const div = document.createElement('div');
                        div.className = "bg-white p-5 rounded-[1.5rem] border border-gray-100 flex justify-between items-center shadow-sm hover:shadow-md transition";
                        div.dataset.paymentMethod = metodo;
                        
                        div.innerHTML = `
                            <div class="flex-1">
                                <p class="font-black text-gray-800 text-lg">${v.isVoucherPgto ? 'Entrada Voucher' : `Pedido #${v.nroPedido}`}</p>
                                <p class="text-xs text-gray-500 font-bold mt-1">${v.cliente} | Pgto: <span class="text-blue-500">${v.pagamento}</span> ${horaStr ? `<span class="text-gray-400 ml-1">| 🕒 ${horaStr}</span>` : ''}</p>
                            </div>
                            <div class="text-right mr-5"><p class="font-black text-green-600 text-xl">R$ ${v.total.toFixed(2)}</p></div>
                            <div class="flex gap-2">
                                <button class="bg-cyan-50 text-cyan-500 hover:bg-cyan-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-view" title="Ver Itens do Pedido"><i class="ph ph-eye text-lg"></i></button>
                                <button class="bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-print" title="Imprimir 2ª Via"><i class="ph ph-printer text-lg"></i></button>
                                <button class="bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-edit" title="Editar Pagamento"><i class="ph ph-pencil-simple text-lg"></i></button>
                                <button class="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition p-3 rounded-xl shadow-sm btn-delete" title="Excluir Venda e Estornar Estoque"><i class="ph ph-trash text-lg"></i></button>
                            </div>
                        `;

                        // MÁGICA DE ABRIR O PEDIDO E EDITAR ITENS
                        div.querySelector('.btn-view').onclick = () => window.openOrderDetails(docSnap.id, v);

                        div.querySelector('.btn-print').onclick = () => {
                            let cupomItems = '';
                            if(v.itens && Array.isArray(v.itens)) {
                                v.itens.forEach(i => {
                                    const qtde = i.qty || i.qtd || 1; 
                                    cupomItems += `<div class="receipt-item"><span>${qtde}x ${i.nome}</span><span>R$ ${(i.preco * qtde).toFixed(2)}</span></div>`;
                                });
                            }
                            const logoHtml = appConfig.logo ? `<img src="${appConfig.logo}" class="receipt-logo">` : '';
                            const printSec = document.getElementById('print-section');
                            if(printSec) {
                                printSec.innerHTML = `
                                    <div class="receipt-header">${logoHtml}<h2 class="receipt-title">${appConfig.nome || 'Matsucafe'}</h2><p class="receipt-info">CNPJ: ${appConfig.cnpj || 'Não informado'}</p><p class="receipt-info">${appConfig.endereco || ''}</p><p class="receipt-info">${appConfig.telefone || ''}</p></div>
                                    <div class="receipt-divider"></div>
                                    <div style="text-align: left;">
                                        <p class="receipt-info" style="font-weight:bold; text-align:center;">*** 2ª VIA DE RECIBO ***</p>
                                        <p class="receipt-info"><strong>Pedido:</strong> #${v.nroPedido}</p>
                                        <p class="receipt-info"><strong>Data:</strong> ${v.dataSimples.split('-').reverse().join('/')} ${horaStr}</p>
                                        <p class="receipt-info"><strong>Cliente:</strong> ${v.cliente}</p>
                                        ${v.cpf ? `<p class="receipt-info"><strong>CPF:</strong> ${v.cpf}</p>` : ''}
                                        <p class="receipt-info"><strong>Pgto:</strong> ${v.pagamento}</p>
                                    </div>
                                    <div class="receipt-divider"></div><div>${cupomItems}</div><div class="receipt-divider"></div>
                                    <div class="receipt-total"><span>TOTAL</span><span>R$ ${v.total.toFixed(2)}</span></div>
                                    <div class="receipt-footer"><p>${appConfig.msg || 'Obrigado e volte sempre!'}</p></div><br>
                                `;
                                setTimeout(() => { window.print(); }, 300);
                            }
                        };

                        div.querySelector('.btn-edit').onclick = async () => {
                            const novoPgto = prompt(`Forma de pagamento atual: ${v.pagamento}\n\nDigite a nova forma de pagamento correta (Ex: Crédito, Débito, PIX, Dinheiro):`, v.pagamento);
                            if(novoPgto && novoPgto.trim() !== "" && novoPgto !== v.pagamento) {
                                if (v.pagamento.toLowerCase().includes('voucher') && !novoPgto.toLowerCase().includes('voucher')) {
                                    const pendQuery = query(collection(db, "vouchers_pendentes"), where("nroPedido", "==", v.nroPedido));
                                    const pendSnap = await getDocs(pendQuery);
                                    if (!pendSnap.empty) {
                                        const pendDoc = pendSnap.docs[0]; const pendData = pendDoc.data();
                                        const c = clients.find(cli => cli.nome === pendData.colaborador);
                                        if(c) {
                                            const novoSaldo = parseFloat(c.saldo_voucher || 0) + parseFloat(pendData.valorRestaurar || pendData.valor);
                                            await updateDoc(doc(db, "clientes", c.id), { saldo_voucher: novoSaldo });
                                        }
                                        await deleteDoc(doc(db, "vouchers_pendentes", pendDoc.id));
                                    }
                                }
                                await updateDoc(doc(db, "vendas", docSnap.id), { pagamento: novoPgto.trim() });
                                alert("Forma de pagamento atualizada com sucesso!");
                            }
                        };

                        div.querySelector('.btn-delete').onclick = async () => {
                            if(confirm('⚠️ ATENÇÃO: Deseja realmente excluir esta venda?\n\n- O valor será removido do caixa.\n- Os produtos serão devolvidos ao estoque.')) {
                                if(v.itens && Array.isArray(v.itens)) {
                                    for(const item of v.itens) {
                                        const qtdeComprada = item.qty || item.qtd || 1;
                                        const cQuery = query(collection(db, "combos"), where("nome", "==", item.nome));
                                        const cSnap = await getDocs(cQuery);
                                        if (!cSnap.empty) {
                                            const comboData = cSnap.docs[0].data();
                                            for (const subItem of comboData.itens) await window.processarEstornoManual(subItem.nome, qtdeComprada);
                                        } else {
                                            await window.processarEstornoManual(item.nome, qtdeComprada);
                                        }
                                    }
                                }

                                if (v.pagamento.toLowerCase().includes('voucher')) {
                                    const pendQuery = query(collection(db, "vouchers_pendentes"), where("nroPedido", "==", v.nroPedido));
                                    const pendSnap = await getDocs(pendQuery);
                                    if (!pendSnap.empty) {
                                        const pendDoc = pendSnap.docs[0]; const pendData = pendDoc.data();
                                        const c = clients.find(cli => cli.nome === pendData.colaborador);
                                        if(c) {
                                            const novoSaldo = parseFloat(c.saldo_voucher || 0) + parseFloat(pendData.valorRestaurar || pendData.valor);
                                            await updateDoc(doc(db, "clientes", c.id), { saldo_voucher: novoSaldo });
                                        }
                                        await deleteDoc(doc(db, "vouchers_pendentes", pendDoc.id));
                                    }
                                }
                                await deleteDoc(doc(db, "vendas", docSnap.id));
                                alert("Venda excluída e produtos estornados para o estoque com sucesso!");
                            }
                        };
                        history.appendChild(div);
                    }
                }
            });

            productSalesEntries = Array.from(productSalesMap.values()).map(entry => {
                const produtoOriginal = products.find(p => p.nome === entry.name);
                const custoUnitario = Number(produtoOriginal?.custo || 0);
                return { ...entry, cost: custoUnitario * entry.qty };
            }).sort((a, b) => b.revenue - a.revenue);
            renderPaymentSummary();
            renderPaymentFilterOptions();
            renderProductSalesSummary();
            applyFinancePaymentFilter();

            // VOUCHERS PENDENTES (LADO DIREITO - AGRUPADOS E CORRIGIDOS)
            const vouchersGrouped = {};
            
            snapVouchers.forEach(docSnap => {
                const pend = docSnap.data();
                if(pend.status === 'pendente') {
                    pendenteTotal += pend.valor;
                    if(!vouchersGrouped[pend.colaborador]) {
                        vouchersGrouped[pend.colaborador] = {
                            colaborador: pend.colaborador,
                            total: 0,
                            items: []
                        };
                    }
                    vouchersGrouped[pend.colaborador].total += pend.valor;
                    vouchersGrouped[pend.colaborador].items.push({ id: docSnap.id, ...pend });
                }
            });

            if (vouchersList) {
                Object.values(vouchersGrouped).forEach(group => {
                    const divGroup = document.createElement('div');
                    divGroup.className = "bg-purple-50 p-5 rounded-[1.5rem] border border-purple-100 flex flex-col shadow-sm transition gap-2";
                    
                    let itemsHtml = '<div class="mt-3 flex flex-col gap-2 border-t border-purple-200 pt-3">';
                    group.items.forEach(pend => {
                        let horaStrPend = '';
                        if (pend.timestamp && typeof pend.timestamp.toDate === 'function') {
                            horaStrPend = pend.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        }
                        
                        itemsHtml += `
                            <div class="bg-white p-3 rounded-xl flex flex-wrap md:flex-nowrap justify-between items-center shadow-sm border border-purple-100 gap-2">
                                <div class="w-full md:w-auto">
                                    <p class="text-sm font-bold text-gray-800">Pedido #${pend.nroPedido}</p>
                                    <p class="text-[10px] text-gray-500 font-bold">${pend.dataStr.split('-').reverse().join('/')} ${horaStrPend}</p>
                                </div>
                                <div class="text-left md:text-right flex-1">
                                    <p class="font-black text-purple-600">R$ ${pend.valor.toFixed(2)}</p>
                                </div>
                                <div class="flex gap-2 w-full md:w-auto justify-end">
                                    <button class="bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white transition p-2 rounded-lg shadow-sm" title="Corrigir Pagamento (Tirar de Voucher)" onclick="window.editVoucher('${pend.id}', '${pend.colaborador}', '${pend.nroPedido}', ${pend.valorRestaurar || pend.valor})"><i class="ph ph-pencil-simple text-sm"></i></button>
                                    <button class="bg-green-500 hover:bg-green-600 transition text-white font-black text-xs px-3 py-2 rounded-lg shadow-sm flex items-center gap-1" onclick="window.baixaVoucher('${pend.id}', '${pend.colaborador}', ${pend.valor}, '${pend.nroPedido}')"><i class="ph ph-check-circle text-sm"></i> Baixa</button>
                                </div>
                            </div>
                        `;
                    });
                    itemsHtml += `
                        <button class="w-full mt-2 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2" onclick="window.baixaTodosVouchers('${group.colaborador}')"><i class="ph ph-check-circle"></i> Dar Baixa em Todos (R$ ${group.total.toFixed(2)})</button>
                    </div>`;

                    divGroup.innerHTML = `
                        <div class="flex justify-between items-center cursor-pointer select-none" onclick="this.nextElementSibling.classList.toggle('hidden'); const icon = this.querySelector('.toggle-icon'); icon.classList.toggle('rotate-180');">
                            <div>
                                <p class="font-black text-purple-800 text-lg uppercase">${group.colaborador}</p>
                                <p class="text-xs text-purple-500 font-bold mt-1">${group.items.length} pedido(s) pendente(s)</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <p class="font-black text-purple-700 text-xl md:text-2xl">R$ ${group.total.toFixed(2)}</p>
                                <button class="bg-purple-200 text-purple-800 p-2 rounded-lg transition-transform duration-200 toggle-icon"><i class="ph ph-caret-down"></i></button>
                            </div>
                        </div>
                        <div class="hidden">
                            ${itemsHtml}
                        </div>
                    `;
                    vouchersList.appendChild(divGroup);
                });
            }

            if(document.getElementById('dash-revenue')) document.getElementById('dash-revenue').innerText = `R$ ${totalVendas.toFixed(2)}`;
            if(document.getElementById('dash-cost')) document.getElementById('dash-cost').innerText = `R$ ${totalCusto.toFixed(2)}`;
            if(document.getElementById('dash-profit')) document.getElementById('dash-profit').innerText = `R$ ${(totalVendas - totalCusto).toFixed(2)}`;
            if(document.getElementById('dash-vouchers')) document.getElementById('dash-vouchers').innerText = `R$ ${pendenteTotal.toFixed(2)}`;
        });
    });
}

function renderPaymentSummary() {
    const list = document.getElementById('payment-summary-list');
    if (!list) return;
    const entries = Object.entries(window.dailyPaymentTotals || {}).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
        list.innerHTML = '<p class="text-sm text-gray-400 font-bold text-center py-6">Nenhum recebimento encontrado no período.</p>';
        return;
    }
    list.innerHTML = entries.map(([method, total]) => `
        <div class="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
            <div>
                <p class="text-xs uppercase text-gray-400 font-black">Forma de pagamento</p>
                <p class="text-base font-black text-gray-800">${method}</p>
            </div>
            <div class="text-right">
                <p class="text-xs uppercase text-gray-400 font-black">Total recebido</p>
                <p class="text-lg font-black text-emerald-600">${formatCurrency(total)}</p>
            </div>
        </div>
    `).join('');
}

function renderPaymentFilterOptions() {
    const select = document.getElementById('finance-payment-filter');
    if (!select) return;
    const atual = select.value || 'Todos';
    const methods = ['Todos', ...Object.keys(window.dailyPaymentTotals || {}).sort()];
    select.innerHTML = methods.map(method => `<option value="${method}">${method}</option>`).join('');
    select.value = methods.includes(atual) ? atual : 'Todos';
}

function applyFinancePaymentFilter() {
    const select = document.getElementById('finance-payment-filter');
    const cards = document.querySelectorAll('#sales-history-list > div');
    if (!select || !cards.length) return;
    const selected = select.value || 'Todos';
    let visibleCount = 0;
    cards.forEach(card => {
        const shouldShow = selected === 'Todos' || card.dataset.paymentMethod === selected;
        card.style.display = shouldShow ? '' : 'none';
        if (shouldShow) visibleCount++;
    });
    const existingEmpty = document.getElementById('finance-sales-empty');
    if (existingEmpty) existingEmpty.remove();
    if (!visibleCount) {
        const empty = document.createElement('p');
        empty.id = 'finance-sales-empty';
        empty.className = 'text-sm text-gray-400 font-bold text-center py-6';
        empty.textContent = 'Nenhuma venda encontrada para essa forma de pagamento no período.';
        document.getElementById('sales-history-list')?.appendChild(empty);
    }
}

function renderProductSalesSummary() {
    const list = document.getElementById('product-sales-summary');
    if (!list) return;
    const term = (document.getElementById('finance-product-filter')?.value || '').trim().toLowerCase();
    const filtered = productSalesEntries.filter(entry => !term || entry.name.toLowerCase().includes(term));
    if (!filtered.length) {
        list.innerHTML = '<p class="text-sm text-gray-400 font-bold text-center py-6">Nenhum produto encontrado nesse filtro.</p>';
        return;
    }
    list.innerHTML = filtered.map(entry => `
        <div class="bg-gray-50 border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <p class="text-base font-black text-gray-800">${entry.name}</p>
                    <p class="text-xs uppercase text-gray-400 font-black mt-1">Quantidade vendida: ${entry.qty}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs uppercase text-gray-400 font-black">Faturamento</p>
                    <p class="text-lg font-black text-green-600">${formatCurrency(entry.revenue)}</p>
                </div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div class="bg-white rounded-xl border border-gray-100 p-3">
                    <p class="text-[10px] uppercase text-gray-400 font-black">Custo estimado</p>
                    <p class="font-black text-orange-500">${formatCurrency(entry.cost)}</p>
                </div>
                <div class="bg-white rounded-xl border border-gray-100 p-3">
                    <p class="text-[10px] uppercase text-gray-400 font-black">Margem estimada</p>
                    <p class="font-black text-blue-600">${formatCurrency(entry.revenue - entry.cost)}</p>
                </div>
            </div>
        </div>
    `).join('');
}

const financePaymentFilter = document.getElementById('finance-payment-filter');
if (financePaymentFilter) financePaymentFilter.addEventListener('change', applyFinancePaymentFilter);
const financeProductFilter = document.getElementById('finance-product-filter');
if (financeProductFilter) financeProductFilter.addEventListener('input', renderProductSalesSummary);

// ==========================================
// FUNÇÃO: VER PEDIDO E REMOVER ITENS
// ==========================================
window.openOrderDetails = (vendaId, venda) => {
    const modal = document.getElementById('modal-pedido');
    if(!modal) return alert("Por favor, adicione o código HTML do Modal de Pedido (modal-pedido) no seu index.html primeiro!");
    
    document.getElementById('detalhe-nro-pedido').innerText = `Pedido #${venda.nroPedido}`;
    document.getElementById('detalhe-cliente-info').innerText = `Cliente: ${venda.cliente} | Pgto: ${venda.pagamento}`;
    document.getElementById('detalhe-total-venda').innerText = `R$ ${venda.total.toFixed(2)}`;
    
    const container = document.getElementById('detalhe-lista-itens');
    container.innerHTML = '';

    if(venda.itens && Array.isArray(venda.itens)) {
        venda.itens.forEach((item, index) => {
            const qtde = item.qty || item.qtd || 1;
            const div = document.createElement('div');
            div.className = "bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm";
            div.innerHTML = `
                <div>
                    <p class="font-bold text-gray-800 text-sm">${qtde}x ${item.nome}</p>
                    <p class="text-xs text-blue-600 font-bold">R$ ${(item.preco * qtde).toFixed(2)}</p>
                </div>
                <button class="bg-red-50 text-red-400 p-2 rounded-lg hover:bg-red-500 hover:text-white transition btn-rem-item" title="Remover item e devolver ao estoque"><i class="ph ph-trash text-lg"></i></button>
            `;
            
            // FUNÇÃO PARA REMOVER O ITEM ESPECÍFICO
            div.querySelector('.btn-rem-item').onclick = async () => {
                if(confirm(`Deseja realmente remover "${item.nome}" deste pedido?\n\n- O valor será abatido do caixa.\n- O produto voltará para o estoque.`)) {
                    
                    const valorItem = item.preco * qtde;
                    const novosItens = venda.itens.filter((_, i) => i !== index); // Remove apenas este item
                    
                    // Atualiza a venda principal reduzindo o total
                    await updateDoc(doc(db, "vendas", vendaId), {
                        itens: novosItens,
                        total: venda.total - valorItem
                    });

                    // Se a venda for voucher, tem que devolver o limite também pro cliente
                    if (venda.pagamento.toLowerCase().includes('voucher')) {
                         const pendQuery = query(collection(db, "vouchers_pendentes"), where("nroPedido", "==", venda.nroPedido));
                         const pendSnap = await getDocs(pendQuery);
                         if (!pendSnap.empty) {
                             const pendDoc = pendSnap.docs[0];
                             const pendData = pendDoc.data();
                             const c = clients.find(cli => cli.nome === pendData.colaborador);
                             if(c) {
                                 const novoSaldo = parseFloat(c.saldo_voucher || 0) + valorItem;
                                 await updateDoc(doc(db, "clientes", c.id), { saldo_voucher: novoSaldo });
                             }
                             // Atualiza o valor da pendência no financeiro
                             await updateDoc(doc(db, "vouchers_pendentes", pendDoc.id), {
                                 valor: pendData.valor - valorItem,
                                 valorRestaurar: (pendData.valorRestaurar || pendData.valor) - valorItem
                             });
                         }
                    }

                    // Devolve produto para o estoque
                    const cQuery = query(collection(db, "combos"), where("nome", "==", item.nome));
                    const cSnap = await getDocs(cQuery);
                    if (!cSnap.empty) { // Se for combo, devolve os sub-itens
                        const comboData = cSnap.docs[0].data();
                        for (const subItem of comboData.itens) await window.processarEstornoManual(subItem.nome, qtde);
                    } else { // Se for produto normal
                        await window.processarEstornoManual(item.nome, qtde);
                    }
                    
                    alert("Item removido com sucesso! Estoque e caixa atualizados.");
                    modal.classList.add('hidden'); 
                }
            };
            container.appendChild(div);
        });
    } else {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center p-4">Nenhum item detalhado encontrado nesta venda.</p>';
    }
    
    if (venda.desconto > 0) {
        container.innerHTML += `
        <div class="p-3 bg-red-50 rounded-xl border border-red-100 mt-2">
            <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-black text-red-600 uppercase">Desconto Aplicado:</span>
                <span class="text-sm font-black text-red-700">- R$ ${venda.desconto.toFixed(2)}</span>
            </div>
            <p class="text-[10px] text-red-500 font-bold uppercase">Motivo: ${venda.motivoDesconto || 'Não informado'}</p>
        </div>`;
    }

    modal.classList.remove('hidden');
};

const btnPrintDay = document.getElementById('btn-print-day');
if(btnPrintDay) {
    btnPrintDay.onclick = () => {
        const printSec = document.getElementById('print-section');
        if(!printSec) return alert("Erro: Container de impressão não encontrado.");
        
        let formasPgtoHtml = '';
        for (const [metodo, valor] of Object.entries(window.dailyPaymentTotals || {})) {
            if (valor > 0) {
                formasPgtoHtml += `<div class="receipt-item"><span>- ${metodo.toUpperCase()}:</span><span>R$ ${valor.toFixed(2)}</span></div>`;
            }
        }

        if(formasPgtoHtml !== '') {
            formasPgtoHtml = `<div class="receipt-divider"></div><div style="text-align:center; font-weight:bold; margin-bottom:5px;">RESUMO POR PAGAMENTO</div>` + formasPgtoHtml;
        }
        
        let periodoStr = currentDateFilterInicio === currentDateFilterFim 
            ? currentDateFilterInicio.split('-').reverse().join('/') 
            : `${currentDateFilterInicio.split('-').reverse().join('/')} a ${currentDateFilterFim.split('-').reverse().join('/')}`;

        printSec.innerHTML = `
            <div class="receipt-header">
                <h2 class="receipt-title">RELATÓRIO DE CAIXA</h2>
                <p class="receipt-info"><strong>PERÍODO:</strong><br>${periodoStr}</p>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-item"><span>ENTRADAS BRUTAS:</span><span>${document.getElementById('dash-revenue').innerText}</span></div>
            ${formasPgtoHtml}
            <div class="receipt-divider"></div>
            <div class="receipt-item"><span>CUSTO (MERCADORIA):</span><span>${document.getElementById('dash-cost').innerText}</span></div>
            <div class="receipt-divider"></div>
            <div class="receipt-total"><span>LUCRO LÍQUIDO:</span><span>${document.getElementById('dash-profit').innerText}</span></div>
            <div class="receipt-divider"></div>
            <div class="receipt-item" style="margin-top: 15px;"><span>VOUCHERS PENDENTES:</span><span>${document.getElementById('dash-vouchers').innerText}</span></div>
            <div class="receipt-footer" style="margin-top:40px;">
                <p>___________________________________</p>
                <p style="font-weight: bold; margin-top:5px;">VISTO GERÊNCIA</p>
            </div>
        `;
        setTimeout(() => { window.print(); }, 300);
    };
}

// ==========================================
// PDV - EXIBINDO ESTOQUE E BLOQUEANDO ZERADOS
// ==========================================
function buildCategoryTabs() {
    const categorias = ["Todos", "Combos", ...new Set(products.map(p => p.categoria))];
    const container = document.getElementById('category-tabs');
    if(!container) return;
    container.innerHTML = categorias.map(c => `<button class="px-6 py-2 rounded-xl font-bold uppercase text-sm whitespace-nowrap bg-gray-100 text-gray-500 shadow-sm transition cat-btn" data-cat="${c}"> ${c}</button>`).join('');
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.cat-btn').forEach(b => { b.classList.replace('theme-bg', 'bg-gray-100'); b.classList.replace('text-white', 'text-gray-500'); });
            btn.classList.replace('bg-gray-100', 'theme-bg'); btn.classList.replace('text-gray-500', 'text-white'); renderPdv(btn.dataset.cat);
        };
    });
    renderPdv('Todos');
}

function renderPdv(filtro) {
    const grid = document.getElementById('product-grid'); 
    if(!grid) return;
    grid.innerHTML = '';
    
    let catalogo = [...products, ...combos.map(c => ({...c, categoria: 'Combos', imagem: c.imagem || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=300&q=80'}))];
    const filtered = filtro === 'Todos' ? catalogo : catalogo.filter(p => p.categoria === filtro);
    
    filtered.forEach(p => {
        const isCombo = p.isCombo;
        let estoqueDisplay = '';
        let opacityClass = '';
        let bloqueado = false;

        if(!isCombo) {
            const totalEstoque = (p.lotes || []).reduce((acc, l) => acc + l.quantidade, 0);
            if (totalEstoque <= 0) {
                estoqueDisplay = `<span class="text-[10px] font-black text-red-600 bg-red-100 px-2 py-1 rounded-md uppercase mt-1 inline-block border border-red-200 shadow-sm">ESGOTADO</span>`;
                opacityClass = 'opacity-40 grayscale pointer-events-none';
                bloqueado = true;
            } else {
                estoqueDisplay = `<span class="text-[10px] font-bold text-gray-500 mt-1 inline-block">${totalEstoque} un. disponíveis</span>`;
            }
        }

        const badge = isCombo ? `<span class="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded-md shadow-md">COMBO</span>` : '';
        const div = document.createElement('div');
        
        div.className = `bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col relative group transition ${opacityClass} ${bloqueado ? '' : 'cursor-pointer hover:shadow-lg hover:-translate-y-1'}`;
        div.innerHTML = `${badge}<img src="${p.imagem}" class="w-full h-36 object-contain bg-gray-50 rounded-2xl mb-4 p-2 transition ${bloqueado ? '' : 'group-hover:scale-105'}">
                         <p class="text-sm font-black leading-tight mb-1 text-gray-800">${p.nome}</p>
                         ${estoqueDisplay}
                         <p class="theme-text font-black text-xl mt-auto pt-3">R$ ${p.preco.toFixed(2)}</p>`;
        
        if(!bloqueado) {
            div.onclick = () => addToCart(p); 
        }
        grid.appendChild(div);
    });
}

function addToCart(p) { 
    if(!p.isCombo) {
        const totalEstoque = (p.lotes || []).reduce((acc, l) => acc + l.quantidade, 0);
        const currentInCart = cart.find(i => i.id === p.id)?.qty || 0;
        if (currentInCart + 1 > totalEstoque) return alert('Você não tem mais estoque suficiente deste produto para adicionar ao carrinho!');
    }
    
    const item = cart.find(i => i.id === p.id); 
    if(item) item.qty++; else cart.push({...p, qty: 1}); 
    updateCart(); 
}

window.removeCartItem = (id) => { cart = cart.filter(item => item.id !== id); updateCart(); }
if(document.getElementById('btn-clear')) document.getElementById('btn-clear').onclick = () => { cart = []; updateCart(); };

function updateCart() {
    const list = document.getElementById('cart-items'); 
    if(!list) return;
    list.innerHTML = ''; 
    let subtotal = 0; // Usamos subtotal antes do desconto

    cart.forEach(item => {
        subtotal += item.preco * item.qty;
        list.innerHTML += `<div class="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-2"><div class="flex-1"><p class="font-black text-gray-800 text-sm leading-tight">${item.qty}x ${item.nome}</p><p class="text-xs text-gray-500 font-bold mt-1">R$ ${(item.preco * item.qty).toFixed(2)}</p></div><button onclick="window.removeCartItem('${item.id}')" class="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-xl transition"><i class="ph ph-x-circle text-lg"></i></button></div>`;
    });

    // Puxa o valor digitado no desconto
    const descInput = document.getElementById('pdv-desconto');
    let valorDesconto = parseFloat(descInput && descInput.value ? descInput.value : 0);
    if (valorDesconto > subtotal) valorDesconto = subtotal; // Impede que o desconto seja maior que a venda

    cartTotal = subtotal - valorDesconto; // cartTotal passa a ser o valor FINAL a ser pago

    if(document.getElementById('subtotal')) document.getElementById('subtotal').innerText = `R$ ${subtotal.toFixed(2)}`;
    if(document.getElementById('total')) document.getElementById('total').innerText = `R$ ${cartTotal.toFixed(2)}`;
}

// Escuta a digitação no campo de desconto para recalcular o total na hora
const descInput = document.getElementById('pdv-desconto');
if(descInput) descInput.addEventListener('input', updateCart);

// ==========================================
// CHECKOUT
// ==========================================
const btnCheckout = document.getElementById('btn-checkout');
if(btnCheckout) {
    btnCheckout.onclick = async () => {
        if(!cart.length) return alert('Carrinho vazio!');
        
        const nro = Math.floor(1000 + Math.random() * 9000);
        const clienteNome = document.getElementById('pdv-cliente').value;
        let pagamento = document.getElementById('pdv-pagamento').value;
        const cpfNaNota = document.getElementById('pdv-cpf').value;
        const dataAtualStr = new Date().toISOString().split('T')[0];
        const valorDescontoDb = parseFloat(document.getElementById('pdv-desconto') ? document.getElementById('pdv-desconto').value : 0) || 0;
        const motivoDescontoDb = document.getElementById('pdv-desconto-motivo') ? document.getElementById('pdv-desconto-motivo').value : '';

        const c = clients.find(cli => cli.nome === clienteNome);
        let valorPagoNaDiferenca = 0;
        let formaPagamentoComplementar = '';

        if (pagamento === 'Voucher') {
            if (!c || !tiposComVoucher.includes(c.tipo)) return alert("Selecione um Colaborador ou Médico válido para usar o Voucher!");
            
            let saldoDisponivel = parseFloat(c.saldo_voucher !== undefined ? c.saldo_voucher : c.voucher || 0);
            let valorDaDiferencaPendura = 0;
            let valorVoucherUsado = 0;
            
            if (cartTotal > saldoDisponivel) {
                const diferenca = cartTotal - saldoDisponivel;
                
                let resposta = prompt(`O saldo de benefício (R$ ${saldoDisponivel.toFixed(2)}) não é suficiente.\nFalta R$ ${diferenca.toFixed(2)}.\n\nDigite a forma de pagamento (PIX, Dinheiro, Cartao) ou digite 'Pendura' para lançar a diferença no fechamento do mês:`);
                
                if (resposta === null || resposta.trim() === '') return alert('Venda cancelada! Forma de pagamento não informada.');

                formaPagamentoComplementar = resposta.trim();
                pagamento = `Voucher + ${formaPagamentoComplementar}`;
                valorVoucherUsado = saldoDisponivel; 

                if (formaPagamentoComplementar.toLowerCase() === 'pendura') {
                    valorDaDiferencaPendura = diferenca;
                } else {
                    valorPagoNaDiferenca = diferenca;
                }
                await updateDoc(doc(db, "clientes", c.id), { saldo_voucher: 0 });

            } else {
                valorVoucherUsado = cartTotal;
                await updateDoc(doc(db, "clientes", c.id), { saldo_voucher: saldoDisponivel - cartTotal });
            }

            const totalParaOFinanceiroCobrar = valorVoucherUsado + valorDaDiferencaPendura;
            if (totalParaOFinanceiroCobrar > 0) {
                await addDoc(collection(db, "vouchers_pendentes"), {
                    colaborador: clienteNome, 
                    colaboradorId: c.id, 
                    valor: totalParaOFinanceiroCobrar, 
                    valorRestaurar: valorVoucherUsado, 
                    status: 'pendente', 
                    nroPedido: nro, 
                    dataStr: dataAtualStr, 
                    timestamp: serverTimestamp()
                });
            }
        }

        let custoDaVenda = 0;
        cart.forEach(item => {
            if (item.isCombo) {
                item.itens.forEach(sub => custoDaVenda += (sub.custo || 0) * item.qty);
            } else {
                custoDaVenda += (item.custo || 0) * item.qty;
            }
        });

        await addDoc(collection(db, "vendas"), {
            nroPedido: nro, total: cartTotal, subtotal: cartTotal + valorDescontoDb, desconto: valorDescontoDb, motivoDesconto: motivoDescontoDb, custoTotal: custoDaVenda, 
            cliente: clienteNome, pagamento: pagamento, cpf: cpfNaNota,
            complemento: valorPagoNaDiferenca, isVoucherPgto: false,
            data: serverTimestamp(), dataSimples: dataAtualStr, itens: cart.map(i => ({ nome: i.nome, qtd: i.qty, preco: i.preco }))
        });

        for(const item of cart) {
            if (item.isCombo) {
                for(const sub of item.itens) {
                    await baixarEstoqueFIFO(sub.id, item.qty);
                }
            } else {
                await baixarEstoqueFIFO(item.id, item.qty);
            }
        }

        let cupomItems = '';
        cart.forEach(i => { cupomItems += `<div class="receipt-item"><span>${i.qty}x ${i.nome}</span><span>R$ ${(i.preco * i.qty).toFixed(2)}</span></div>`; });
        const logoHtml = appConfig.logo ? `<img src="${appConfig.logo}" class="receipt-logo">` : '';

        const printSec = document.getElementById('print-section');
        if(printSec) {
            printSec.innerHTML = `
                <div class="receipt-header">
                    ${logoHtml}
                    <h2 class="receipt-title">${appConfig.nome || 'Matsucafe'}</h2>
                    <p class="receipt-info">CNPJ: ${appConfig.cnpj || 'Não informado'}</p>
                    <p class="receipt-info">${appConfig.endereco || ''}</p>
                    <p class="receipt-info">${appConfig.telefone || ''}</p>
                </div>
                <div class="receipt-divider"></div>
                <div style="text-align: left;">
                    <p class="receipt-info"><strong>Pedido:</strong> #${nro}</p>
                    <p class="receipt-info"><strong>Data:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
                    <p class="receipt-info"><strong>Cliente:</strong> ${clienteNome}</p>
                    ${cpfNaNota ? `<p class="receipt-info"><strong>CPF:</strong> ${cpfNaNota}</p>` : ''}
                    <p class="receipt-info"><strong>Pgto:</strong> ${pagamento}</p>
                </div>
                <div class="receipt-divider"></div>
                <div>${cupomItems}</div>
                ${valorDescontoDb > 0 ? `<div class="receipt-item" style="color:red; margin-top:5px;"><span>DESCONTO:</span><span>- R$ ${valorDescontoDb.toFixed(2)}</span></div>` : ''}
                <div class="receipt-divider"></div>
                <div class="receipt-total"><span>TOTAL PAGO</span><span>R$ ${cartTotal.toFixed(2)}</span></div>
                <div class="receipt-footer"><p>${appConfig.msg || 'Obrigado e volte sempre!'}</p></div>
                <br>
            `;
            setTimeout(() => { window.print(); }, 300);
        }
        cart = []; updateCart(); 
        if(document.getElementById('pdv-cpf')) document.getElementById('pdv-cpf').value = '';
        if(document.getElementById('pdv-desconto')) document.getElementById('pdv-desconto').value = ''; 
        if(document.getElementById('pdv-desconto-motivo')) document.getElementById('pdv-desconto-motivo').value = '';
    };
}

// ==========================================
// FUNÇÕES GLOBAIS DE MODAL E UI
// ==========================================
window.closeModals = () => {
    document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('input:not([type="date"])').forEach(i => i.value = '');
};

window.renovarVouchers = async () => {
    if(confirm("ATENÇÃO: Isso vai restaurar o saldo de todos os Colaboradores/Médicos para o Limite Mensal e ZERAR o saldo dos Estagiários. Deseja realizar a Virada de Mês?")) {
        
        let atualizados = 0;
        
        clients.forEach(async (c) => {
            if(tiposComVoucher.includes(c.tipo)) {
                let novoSaldo = 0;
                let deveAtualizar = false;

                if (c.tipo === 'Estagiário') {
                    novoSaldo = 0; 
                    deveAtualizar = true; 
                } else if (c.voucher > 0) {
                    novoSaldo = parseFloat(c.voucher); 
                    deveAtualizar = true;
                }

                if (deveAtualizar) {
                    await updateDoc(doc(db, "clientes", c.id), { 
                        saldo_voucher: novoSaldo 
                    });
                    atualizados++;
                }
            }
        });
        
        if (atualizados > 0) {
            alert("Virada de mês concluída! Limites atualizados.");
        } else {
            alert("Nenhum saldo foi modificado.");
        }
    }
};

window.openProductModal = (p = null) => {
    document.getElementById('modal-produto').classList.remove('hidden');
    document.getElementById('edit-id').value = p ? p.id : '';
    document.getElementById('prod-estoque-lote').value = '';
    document.getElementById('prod-entrada').value = new Date().toISOString().split('T')[0];
    document.getElementById('prod-validade').value = '';

    if(p) {
        document.getElementById('modal-title').innerText = "Editar Produto Base";
        if(document.getElementById('modal-subtitle')) document.getElementById('modal-subtitle').classList.remove('hidden');
        document.getElementById('prod-nome').value = p.nome; document.getElementById('prod-categoria').value = p.categoria;
        document.getElementById('prod-venda').value = p.preco; document.getElementById('prod-custo').value = p.custo;
        document.getElementById('prod-imagem').value = p.imagem;
    } else {
        document.getElementById('modal-title').innerText = "Novo Produto";
        if(document.getElementById('modal-subtitle')) document.getElementById('modal-subtitle').classList.add('hidden');
    }
};

window.openClientModal = (c = null) => {
    document.getElementById('modal-cliente').classList.remove('hidden');
    document.getElementById('cli-id').value = c ? c.id : '';
    document.getElementById('cli-add-saldo').value = ''; 
    
    if(c) {
        document.getElementById('cli-tipo').value = c.tipo; 
        document.getElementById('cli-nome').value = c.nome;
        document.getElementById('cli-telefone').value = c.telefone; 
        document.getElementById('cli-voucher').value = c.voucher || '';
        document.getElementById('cli-saldo-voucher').value = c.saldo_voucher !== undefined ? c.saldo_voucher : (c.voucher || '');
    } else { 
        document.getElementById('cli-tipo').value = 'Cliente'; 
        document.getElementById('cli-voucher').value = '';
        document.getElementById('cli-saldo-voucher').value = '';
    }
    window.toggleVoucher();
};

window.toggleVoucher = () => {
    const tipo = document.getElementById('cli-tipo').value;
    const container = document.getElementById('cli-voucher-container');
    
    if (tiposComVoucher.includes(tipo)) {
        container.classList.remove('hidden'); container.classList.add('block');
    } else {
        container.classList.add('hidden'); container.classList.remove('block');
    }
};

window.openHistoryModal = (clienteNome) => {
    currentClientHistory = clienteNome;
    document.getElementById('hist-nome').innerText = clienteNome;
    document.getElementById('modal-historico').classList.remove('hidden');
    window.loadClientHistory();
};

window.openComboModal = () => {
    document.getElementById('modal-combo').classList.remove('hidden');
    const lista = document.getElementById('combo-produtos-lista');
    lista.innerHTML = '';
    products.forEach(p => {
        lista.innerHTML += `
            <label class="flex items-center gap-3 bg-white p-3 border rounded-xl cursor-pointer hover:bg-gray-100 transition shadow-sm">
                <input type="checkbox" value="${p.id}" class="combo-prod-check w-5 h-5 accent-green-600">
                <span class="font-bold text-sm text-gray-700">${p.nome} (Custo Peça: R$ ${(p.custo || 0).toFixed(2)})</span>
            </label>
        `;
    });
};
