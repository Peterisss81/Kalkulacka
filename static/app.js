//srdce celé kalkulačky
const pastelColors = [
    "#FFD8D8", "#D8FFD8", "#D8D8FF", "#FFF8D8",
    "#D8FFF8", "#F8D8FF", "#FFE4C4", "#E4FFC4",
    "#C4E4FF", "#F0E68C", "#E6E6FA", "#FFFACD",
    "#F5DEB3", "#E0FFFF", "#FAFAD2", "#DDDDDD",
	"#EEEEEE"
];

let materials = {};
let data = DATA;
// 🔹 explicitní pořadí celků (ROZHODUJÍCÍ)
if (!data.celkyOrder) {
    data.celkyOrder = Object.keys(data.celky || {});
}


let nextCelekId = 1;  // globální čítač pro nové celky
let nextPolozkaId = 1; // globální čítač pro nové položky

// Udržujeme stav minimalizace
let collapsedCelky = {};   // { '1': true, '2': false, ... }
let collapsedColors = {};  // { '#F0E68C': true, '#FF0000': false, ... }



function render(newlyAddedCelekIds = []) { // 🔹 parametr pro animaci nových celků
    const container = document.getElementById("celky");
    container.innerHTML = "";
    const colorTotals = recalcColorTotals();

    //const celekIds = Object.keys(data.celky);
	const celekIds = data.celkyOrder;


    if (celekIds.length === 0) {
        container.innerHTML = "<i>Zatím není přidán žádný celek</i>";
        return;
    }

    celekIds.forEach(celekId => {
        const celek = data.celky[celekId];

        const div = document.createElement("div");
        div.className = "celek";

        // 🆕 aplikace barvy celku (pokud existuje)
        if (celek.color) {
            div.style.backgroundColor = celek.color;
        }

        // 🔹 vizuální efekt ignorovaného celku
        if (celek.ignored) {
            div.classList.add("ignored");
        }

        div.innerHTML = `
            <div class="celek-header">
                <button onclick="moveCelekUp('${celekId}')">↑</button>
                <button onclick="moveCelekDown('${celekId}')">↓</button>
				<button class="copy-celek" title="Zkopírovat celek" onclick="copyCelek('${celekId}')">📄</button>


                <input class="celek-name" value="${celek.name}"
                       onchange="data.celky['${celekId}'].name=this.value">

                <button class="add-polozka" onclick="addPolozka('${celekId}')">➕ Položka</button>

                <button 
                    class="ignore-switch ${celek.ignored ? 'ignoruj' : 'zapocitej'}"
                    onclick="toggleIgnoreCelek(this,'${celekId}')">
                    ${celek.ignored ? 'Ignoruji celek' : 'Započítávám celek'}
                </button>

                <select onchange="changeCelekColor('${celekId}', this.value)">
                    ${pastelColors.map(c => `
                        <option 
                            value="${c}" 
                            ${c === celek.color ? 'selected' : ''}
                            style="background-color:${c}; color:#000;"
                        >
                            ${c}
                        </option>
                    `).join('')}
                </select>

                <button class="partial-export" 
                    onclick="exportBarvaJSON('${celekId}')">
                    Export barvy
                </button>
                
                <button onclick="importBarvaJSON('${celekId}')">Parciální import do této barvy</button>
				
				<button onclick="toggleCelek('${celekId}', true)">Minimalizuj celek</button>
				<button onclick="toggleCelek('${celekId}', false)">Maximalizuj celek</button>
				<button onclick="toggleColor('${celek.color}', true)">Minimalizuj barvu</button>
				<button onclick="toggleColor('${celek.color}', false)">Maximalizuj barvu</button>


                <button class="delete-celek" style="margin-left:auto"
                        onclick="deleteCelek('${celekId}')">
                        Odebrat celek❌
                </button>
            </div>

            <div id="polozky-${celekId}"></div>
        `;

        container.appendChild(div);

        const polozkyDiv = div.querySelector(`#polozky-${celekId}`);
		polozkyDiv.style.display = collapsedCelky[celekId] ? 'none' : 'block';

        Object.keys(celek.polozky).forEach(pid => {
            const p = celek.polozky[pid];
            const polozkaDiv = renderPolozka(celekId, pid);

            const ignoreBtn = polozkaDiv.querySelector('.ignore-switch');

            if (p.ignored) {
                polozkaDiv.classList.add('ignored');

                if (ignoreBtn) {
                    ignoreBtn.textContent = 'Ignoruju';
                    ignoreBtn.classList.add('ignoruj');
                    ignoreBtn.classList.remove('zapocitej');
                }
            } else {
                polozkaDiv.classList.remove('ignored');

                if (ignoreBtn) {
                    ignoreBtn.textContent = 'Započítávám';
                    ignoreBtn.classList.add('zapocitej');
                    ignoreBtn.classList.remove('ignoruj');
                }
            }

            polozkyDiv.appendChild(polozkaDiv);
        });

        // Součet celku
        const soucetDiv = document.createElement("div");
        soucetDiv.className = "celek-soucet";
        soucetDiv.innerHTML = `
			<div class="row row-price">
				<div class="row row-left">
					<b>Celek Součet:</b>
					plocha: <input class="readonly small" value="${celek.totalPlocha ?? 0}" readonly>
					objem: <input class="readonly small" value="${celek.totalObjem ?? 0}" readonly>
					účt. plocha: <input class="readonly small" value="${(celek.totalUctPl ?? 0).toFixed(3)}" readonly>
					účt. objem: <input class="readonly small" value="${(celek.totalUctOb ?? 0).toFixed(3)}" readonly>
				</div>
				<div class="row row-right">
					<div class="polozka-celkem">
						Nákupka: <input class="readonly" value="${celek.nakupkaCena ?? 0}" readonly>
						URS: <input class="readonly" value="${celek.ursCena ?? 0}" readonly>
						Firma: <input class="readonly" value="${celek.firmaCena ?? 0}" readonly>
					</div>
				</div>
			</div>
        `;

        div.appendChild(soucetDiv);
        
        const ct = colorTotals[celek.color] || { nakupka: 0, urs: 0, firma: 0 };

        const colorSummaryDiv = document.createElement("div");
        colorSummaryDiv.className = "celek-color-summary";
        colorSummaryDiv.innerHTML = `
            <small><b>Součet této barvy:</b></small>
            Nákupka: <b>${ct.nakupka.toFixed(2)}</b>,
            URS: <b>${ct.urs.toFixed(2)}</b>,
            Firma: <b>${ct.firma.toFixed(2)}</b>
        `;

        div.appendChild(colorSummaryDiv);

        // 🔹 pokud je celek nově přidaný, přidej animaci
        if (newlyAddedCelekIds.includes(celekId)) {
            div.classList.add("celek-new");
            setTimeout(() => div.classList.remove("celek-new"), 2000);
        }
    });

    recalcGlobalCeny();
    renderGlobalCeny();
    renderIgnoredSummary();
}








function renderPolozka(celekId, pid) {
    const p = data.celky[celekId].polozky[pid];

    // ➕ defaulty
    if (p.unitFactor === undefined) p.unitFactor = 1;
    if (p.namerFactor === undefined) p.namerFactor = 1;

    const div = document.createElement("div");
    div.className = "polozka";

    div.innerHTML = `

        <!-- ================= PRVNÍ ŘÁDEK ================= -->
        <div class="row row-main">
			<button onclick="movePolozkaUp('${celekId}','${pid}')">↑</button>
			<button onclick="movePolozkaDown('${celekId}','${pid}')">↓</button>
			<button class="copy-polozka" title="Zkopírovat položku" onclick="copyPolozka('${celekId}','${pid}')">📄</button>


            <!-- Název položky -->
            <input type="text" value="${p.name}"
                onchange="data.celky['${celekId}'].polozky['${pid}'].name=this.value">


			<!-- Materiál -->
			<select data-celek="${celekId}" data-polozka="${pid}" onchange="onMaterialChange('${celekId}','${pid}', this.value)">
				${renderMaterials(p.material)}
			</select>


            <!-- Rozměry -->
            <span>a</span>
            <input type="number" value="${p.a}"
                onchange="
                    data.celky['${celekId}'].polozky['${pid}'].a=+this.value;
                    recalcPolozka('${celekId}','${pid}');
                    render();
                ">

            <span>b</span>
            <input type="number" value="${p.b}"
                onchange="
                    data.celky['${celekId}'].polozky['${pid}'].b=+this.value;
                    recalcPolozka('${celekId}','${pid}');
                    render();
                ">

            <span>v</span>
            <input type="number" value="${p.v}"
                onchange="
                    data.celky['${celekId}'].polozky['${pid}'].v=+this.value;
                    recalcPolozka('${celekId}','${pid}');
                    render();
                ">

            <!-- Výsledky geometrie -->
            <span>pl(m²)</span>
			<input class="readonly small pl-value ${p.cena.priceFromM2 ? 'highlight-m2' : ''}" value="${p.pl}" readonly>

			<span>ob(m³)</span>
			<input class="readonly small ob-value ${!p.cena.priceFromM2 ? 'highlight-m3' : ''}" value="${p.ob}" readonly>


            <!-- Přepínač m² / m³ -->
            <button
                class="price-switch ${p.cena.priceFromM2 ? 'm2' : 'm3'}"
                onclick="togglePriceMode(this, '${celekId}', '${pid}')">
                ${p.cena.priceFromM2 ? 'cena z m²' : 'cena z m³'}
            </button>

            <!-- Modifikátor -->
            <span>modif.</span>
            <input type="number"
                step="0.01"
                value="${p.unitFactor}"
                title="Např. 1.7 = t / m³"
                onchange="
                    data.celky['${celekId}'].polozky['${pid}'].unitFactor=+this.value;
                    recalcPolozka('${celekId}','${pid}');
                    render();
                ">

            <!-- Náměr -->
            <span>náměr %</span>
            <input type="number"
                step="1"
                value="${(p.namerFactor - 1) * 100}"
                title="Rezerva materiálu v %"
                onchange="
                    data.celky['${celekId}'].polozky['${pid}'].namerFactor = 1 + (+this.value / 100);
                    recalcPolozka('${celekId}','${pid}');
                    render();
                ">

            <!-- Účtované množství -->
            <span>účt. množ.</span>
				<input class="readonly small uctValue ${p.cena.priceFromM2 ? 'highlight-m2' : 'highlight-m3'}"
					   value="${
						   ((p.cena.priceFromM2 ? p.pl : p.ob) * p.unitFactor * p.namerFactor).toFixed(3)
					   }"
					   readonly>
					   
			<button
				class="ignore-switch"
				onclick="toggleIgnorePolozka(this,'${celekId}','${pid}')">
				${p.ignored ? "Ignoruju" : "Započítávám"}
			</button>

			<!-- Mazání -->
			<button class="button" style="margin-left:auto;" onclick="deletePolozka('${celekId}','${pid}')">Odebrat položku ❌</button>	



        </div>

        <!-- ================= DRUHÝ ŘÁDEK ================= -->
        <div class="row row-price">

			<div class="row-left">
				<!-- Cena jednotková -->
				<span>Jednotka:</span>
				Nákupka <input type="number" value="${p.cena.nakupkaUnit}"
					onchange="
						data.celky['${celekId}'].polozky['${pid}'].cena.nakupkaUnit=+this.value;
						recalcPolozka('${celekId}','${pid}');
						render();
					">
				URS <input type="number" value="${p.cena.ursUnit}"
					onchange="
						data.celky['${celekId}'].polozky['${pid}'].cena.ursUnit=+this.value;
						recalcPolozka('${celekId}','${pid}');
						render();
					">
				Firma <input type="number" value="${p.cena.firmaUnit}"
					onchange="
						data.celky['${celekId}'].polozky['${pid}'].cena.firmaUnit=+this.value;
						recalcPolozka('${celekId}','${pid}');
						render();
					">

			</div>
			<div class="row-right">
				<div class="polozka-celkem">
					<span class="label">Celkem:</span>

					<span>
						Nákupka
						<input class="readonly" value="${p.cena.nakupkaTotal}" readonly>
					</span>

					<span>
						URS
						<input class="readonly" value="${p.cena.ursTotal}" readonly>
					</span>

					<span>
						Firma
						<input class="readonly" value="${p.cena.firmaTotal}" readonly>
					</span>
				</div>
			</div> 
					
        </div>
		
    `;

    return div;
}


function renderCelekCeny(celekId) {
    const celek = data.celky[celekId];
    const div = document.querySelector(`#polozky-${celekId} ~ .celek-soucet`);
    if (!div) return;

    div.innerHTML = `
		<div class="row row-price">
			<div class="row-left">
				<b>Celek Součet:</b>
				plocha: <input class="readonly small" value="${celek.totalPlocha}" readonly>
				objem: <input class="readonly small" value="${celek.totalObjem}" readonly>
				účt. plocha: <input class="readonly" value="${celek.totalUctPl.toFixed(3)}" readonly>
				účt. objem: <input class="readonly" value="${celek.totalUctOb.toFixed(3)}" readonly>
			</div>
			<div class="row-right">
				<div class="polozka-celkem">
					Nákupka: <input class="readonly" value="${celek.nakupkaCena}" readonly>
					URS: <input class="readonly" value="${celek.ursCena}" readonly>
					Firma: <input class="readonly" value="${celek.firmaCena}" readonly>
				</div>
			</div>
		</div>
    `;
}



function renderGlobalCeny() {
    document.getElementById("globalNakupka").textContent = data.globalData.globalCeny.nakupka.cena.toFixed(2);
    document.getElementById("globalURS").textContent = data.globalData.globalCeny.urs.cena.toFixed(2);
    document.getElementById("globalFirma").textContent = data.globalData.globalCeny.firma.cena.toFixed(2);
}



function renderMaterials(selected) {
    return Object.entries(materials)
        .sort(([a], [b]) => a.localeCompare(b, 'cs'))
        .map(([key, mat]) => `
            <option value="${key}" ${key === selected ? "selected" : ""}>
                ${mat.name}
            </option>
        `)
        .join("");
}





// --- Souhrn ignorovaných cen ---
function renderIgnoredSummary() {
    let nakupka = 0;
    let urs = 0;
    let firma = 0;

    Object.keys(data.celky).forEach(celekId => {
        const celek = data.celky[celekId];

        if (celek.ignored) {
            // celek je ignorovaný → přičteme všechny jeho ceny
            nakupka += celek.nakupkaCena;
            urs += celek.ursCena;
            firma += celek.firmaCena;
        } else {
            // celek započítávaný → přičteme jen ignorované položky
            Object.keys(celek.polozky).forEach(pid => {
                const p = celek.polozky[pid];
                if (p.ignored) {
                    nakupka += p.cena.nakupkaTotal;
                    urs += p.cena.ursTotal;
                    firma += p.cena.firmaTotal;
                }
            });
        }
    });

    const summaryEl = document.getElementById("ignoredSummary");
    if (summaryEl) {
        summaryEl.textContent = `Ignorované celky/položky: Nákupka ${nakupka.toFixed(2)}, URS ${urs.toFixed(2)}, Firma ${firma.toFixed(2)}`;
    }
}


// Minimalizuje nebo maximalizuje jeden celek
function toggleCelek(celekId, collapse) {
    collapsedCelky[celekId] = collapse;
    const div = document.querySelector(`#polozky-${celekId}`);
    if (div) div.style.display = collapse ? 'none' : 'block';
}

// Minimalizuje nebo maximalizuje všechny celky stejné barvy
function toggleColor(barva, collapse) {
    collapsedColors[barva] = collapse;

    Object.keys(data.celky).forEach(celekId => {
        const celek = data.celky[celekId];
        if (celek.color === barva) {
            toggleCelek(celekId, collapse);
        }
    });
}

function collapseAll() { Object.keys(data.celky).forEach(id => toggleCelek(id, true)); }
function expandAll()   { Object.keys(data.celky).forEach(id => toggleCelek(id, false)); }




// PŘEPOČTY
function recalcColorTotals() {
    const totals = {};

    Object.values(data.celky).forEach(celek => {
        if (celek.ignored) return;

        const color = celek.color || '#ffffff';

        if (!totals[color]) {
            totals[color] = {
                nakupka: 0,
                urs: 0,
                firma: 0
            };
        }

        totals[color].nakupka += celek.nakupkaCena || 0;
        totals[color].urs     += celek.ursCena || 0;
        totals[color].firma   += celek.firmaCena || 0;
    });

    return totals;
}

function recalcNextCelekId() {
    const ids = Object.keys(data.celky).map(id => parseInt(id));
    nextCelekId = ids.length ? Math.max(...ids) + 1 : 1;
}

function recalcNextPolozkaId() {
    const pids = [];
    Object.values(data.celky).forEach(c => {
        Object.keys(c.polozky).forEach(pid => pids.push(parseInt(pid)));
    });
    nextPolozkaId = pids.length ? Math.max(...pids) + 1 : 1;
}





function recalculate() {
    for (const cid in data.celky) {
        if (cid === "nextCelekId") continue;
        const celek = data.celky[cid];

        let totalPl = 0;
        let totalOb = 0;
        let n = 0, u = 0, f = 0;

        for (const pid in celek.polozky) {
            if (pid === "nextPolozkaId") continue;
            const p = celek.polozky[pid];

            p.pl = p.a * p.b;
            p.ob = p.a * p.b * p.v;

            const base = p.cena.priceFromM2 ? p.pl : p.ob;

            p.cena.nakupkaTotal = base * p.cena.nakupkaUnit;
            p.cena.ursTotal = base * p.cena.ursUnit;
            p.cena.firmaTotal = base * p.cena.firmaUnit;

            totalPl += p.pl;
            totalOb += p.ob;
            n += p.cena.nakupkaTotal;
            u += p.cena.ursTotal;
            f += p.cena.firmaTotal;
        }

        celek.totalPlocha = totalPl;
        celek.totalObjem = totalOb;
        celek.nakupkaCena = n;
        celek.ursCena = u;
        celek.firmaCena = f;
    }

    render();
}

function onMaterialChange(celekId, pid, materialKey) {
    const p = data.celky[celekId].polozky[pid];
    p.material = materialKey;

    // Pokud materiál existuje v aktuálním seznamu materials, nastav defaultní ceny
    if (materialKey && materials[materialKey]) {
        const defaultCena = materials[materialKey].unitCenaDefault || 0;

        p.cena.nakupkaUnit = defaultCena;
        p.cena.ursUnit = defaultCena;
        p.cena.firmaUnit = defaultCena;
    }

    recalculate();
}



function onPriceModeChange(celekId, pid, fromM2) {
    data.celky[celekId].polozky[pid].cena.priceFromM2 = fromM2;
    recalculate();
}

function togglePriceMode(btn, celekId, pid) {
    const p = data.celky[celekId].polozky[pid];
    const newValue = !p.cena.priceFromM2;

    // přepnout logiku v JSONu
    onPriceModeChange(celekId, pid, newValue);

    // přepnout vzhled tlačítka
    btn.classList.toggle('m2', newValue);
    btn.classList.toggle('m3', !newValue);
    btn.textContent = newValue ? 'cena z m²' : 'cena z m³';

    // změnit barvu polí
    const div = btn.closest('.polozka');
    const plInput = div.querySelector('.pl-value');
    const obInput = div.querySelector('.ob-value');
	const uctInput = div.querySelector('.uctValue');

    if(newValue){
        plInput.classList.add('highlight-m2');
        plInput.classList.remove('highlight-m3');
        obInput.classList.remove('highlight-m2','highlight-m3');
		uctInput.classList.add('highlight-m2');
		uctInput.classList.remove('highlight-m3');
    } else {
        obInput.classList.add('highlight-m3');
        obInput.classList.remove('highlight-m2');
        plInput.classList.remove('highlight-m2','highlight-m3');
		uctInput.classList.add('highlight-m3');
		uctInput.classList.remove('highlight-m2');
    }
	
	// ➕ NOVÉ – okamžitý přepočet pouze pro tuto položku + celek + globální ceny
    recalcPolozka(celekId, pid);
    recalcCelek(celekId);
    recalcGlobalCeny();

    // aktualizace jen cen celku a globální ceny (bez přepisování ignorovaných položek)
    renderCelekCeny(celekId);
    renderGlobalCeny();
}





function recalcPolozka(celekId, pid) {
    const p = data.celky[celekId].polozky[pid];

    // ochrany
    if (p.unitFactor === undefined) p.unitFactor = 1;
    if (p.namerFactor === undefined) p.namerFactor = 1;

    // geometrie
    p.pl = +(p.a * p.b).toFixed(3);
    p.ob = +(p.a * p.b * p.v).toFixed(3);

    // základ množství
    const baseQty = p.cena.priceFromM2 ? p.pl : p.ob;

    // ➕ NOVÉ: modifikátor + námer
    const qty =
        baseQty *
        p.unitFactor *
        p.namerFactor;

    // ceny
    p.cena.nakupkaTotal = +(qty * p.cena.nakupkaUnit).toFixed(2);
    p.cena.ursTotal     = +(qty * p.cena.ursUnit).toFixed(2);
    p.cena.firmaTotal   = +(qty * p.cena.firmaUnit).toFixed(2);
}


function recalcAll() {
    for (const celekId in data.celky) {
        const celek = data.celky[celekId];

        for (const pid in celek.polozky) {
            recalcPolozka(celekId, pid);
        }
    }

    render();
}

function recalcGlobalCeny() {
    let totalNakupka = 0;
    let totalURS = 0;
    let totalFirma = 0;

    Object.keys(data.celky).forEach(celekId => {
        const celek = data.celky[celekId];

        // ⛔ pokud někdy přidáš ignore na celý celek
        if (celek.ignored) return;

        // 👈 zajistíme, že celek má aktuální hodnoty
        recalcCelek(celekId);

        totalNakupka += celek.nakupkaCena;
        totalURS += celek.ursCena;
        totalFirma += celek.firmaCena;
    });

    data.globalData.globalCeny.nakupka.cena = totalNakupka;
    data.globalData.globalCeny.urs.cena = totalURS;
    data.globalData.globalCeny.firma.cena = totalFirma;
}




// Přepočítá součty celku podle všech jeho položek
function recalcCelek(celekId) {
    const celek = data.celky[celekId];

    // inicializace součtů
    let totalPl = 0;
    let totalOb = 0;
    let totalUctPl = 0;
    let totalUctOb = 0;
    let totalNakupka = 0;
    let totalURS = 0;
    let totalFirma = 0;

    Object.keys(celek.polozky).forEach(pid => {
        const p = celek.polozky[pid];

        // 🔁 položku vždy přepočítáme (kvůli UI)
        recalcPolozka(celekId, pid);

        // ⛔️ pokud je ignorovaná, dál ji NEZAPOČÍTÁVÁME
        if (p.ignored) return;

        // sečteme základní plochu a objem
        totalPl += p.pl;
        totalOb += p.ob;

        // účtované množství podle priceFromM2
        const uct = (p.cena.priceFromM2 ? p.pl : p.ob) * p.unitFactor * p.namerFactor;
        totalUctPl += p.cena.priceFromM2 ? uct : 0;
        totalUctOb += !p.cena.priceFromM2 ? uct : 0;

        // ceny
        totalNakupka += p.cena.nakupkaTotal;
        totalURS += p.cena.ursTotal;
        totalFirma += p.cena.firmaTotal;
    });

    // uložíme zpět do celku
    celek.totalPlocha = totalPl;
    celek.totalObjem = totalOb;
    celek.totalUctPl = totalUctPl;
    celek.totalUctOb = totalUctOb;
    celek.nakupkaCena = totalNakupka;
    celek.ursCena = totalURS;
    celek.firmaCena = totalFirma;
}


/*
function toggleIgnorePolozka(btn, celekId, pid) {
    const p = data.celky[celekId].polozky[pid];

    // 🔁 toggle
    p.ignored = !p.ignored;

    // 🎨 UI
    btn.textContent = p.ignored ? "Ignoruju" : "Započítávám";
    btn.classList.toggle("ignored", p.ignored);

    const row = btn.closest(".polozka");
    row.classList.toggle("polozka-ignored", p.ignored);

    // 🔢 přepočty
    recalcCelek(celekId);
    recalcGlobalCeny();
    render();
}
*/

// --- Přepnutí ignorování položky ---
function toggleIgnorePolozka(btn, celekId, pid) {
    const p = data.celky[celekId].polozky[pid];
    p.ignored = !p.ignored;

    btn.textContent = p.ignored ? 'Ignoruju' : 'Započítávám';
    btn.classList.toggle('zapocitej', !p.ignored);
    btn.classList.toggle('ignoruj', p.ignored);
    btn.classList.toggle('ignored', p.ignored);

    const row = btn.closest('.polozka');
    if (row) row.classList.toggle('ignored', p.ignored);

    recalcCelek(celekId);
    recalcGlobalCeny();
    renderCelekCeny(celekId);
    renderGlobalCeny();
    renderIgnoredSummary(); // aktualizace souhrnu
}


/*
function toggleIgnoreCelek(btn, celekId) {
    const celek = data.celky[celekId];

    // 1️⃣ přepnout flag
    celek.ignored = !celek.ignored;

    // 2️⃣ tlačítko – text + barva
    btn.textContent = celek.ignored ? 'Ignoruji celek' : 'Započítávám celek';
    btn.classList.toggle('zapocitej', !celek.ignored);
    btn.classList.toggle('ignoruj', celek.ignored);
    btn.classList.toggle('ignored', celek.ignored);

    // 3️⃣ celý celek – šedivý
    const celekDiv = btn.closest('.celek');
    if (celekDiv) {
        celekDiv.classList.toggle('ignored', celek.ignored);
    }

    // 4️⃣ přepočty
    recalcGlobalCeny();

    // aktualizace – můžeme použít render() nebo jen ceny
    render();  // pokud chceš aktualizovat i vzhled položek a celků
}
*/
// --- Přepnutí ignorování celku ---
function toggleIgnoreCelek(btn, celekId) {
    const celek = data.celky[celekId];
    celek.ignored = !celek.ignored;

    btn.textContent = celek.ignored ? 'Ignoruj celek' : 'Započítej celek';
    btn.classList.toggle('ignoruj', celek.ignored);
    btn.classList.toggle('zapocitej', !celek.ignored);

    const celekDiv = btn.closest('.celek');
    if (celekDiv) celekDiv.classList.toggle('ignored', celek.ignored);

    recalcGlobalCeny();
    render();
    renderIgnoredSummary(); // aktualizace souhrnu
}


// --- Ignorovat vše ---
function ignoreAll() {
    Object.keys(data.celky).forEach(celekId => {
        const celek = data.celky[celekId];
        celek.ignored = true;
        // označit všechny položky jako ignorované (pro přehled UI)
        Object.keys(celek.polozky).forEach(pid => {
            celek.polozky[pid].ignored = true;
        });
    });
    recalcGlobalCeny();
    render();
    renderIgnoredSummary();
}

// --- Započítat vše ---
function includeAll() {
    Object.keys(data.celky).forEach(celekId => {
        const celek = data.celky[celekId];
        celek.ignored = false;
        // všechny položky započítávány
        Object.keys(celek.polozky).forEach(pid => {
            celek.polozky[pid].ignored = false;
        });
    });
    recalcGlobalCeny();
    render();
    renderIgnoredSummary();
}










// PŘIDÁVANÍ a MAZÁNÍ
function addCelek() {
    recalcNextCelekId();
    const id = String(nextCelekId);

    data.celky[id] = {
        name: "Nový celek",
        ignored: false,
        color: "#EEEEEE",
        polozky: {},
        nextPolozkaId: 1,
        totalPlocha: 0,
        totalObjem: 0,
        totalUctPl: 0,
        totalUctOb: 0,
        nakupkaCena: 0,
        ursCena: 0,
        firmaCena: 0
    };

    data.celkyOrder.push(id);   // 🔹 POŘADÍ
    recalcNextCelekId();
    render();
}




function deleteCelek(celekId) {
    if (!confirm("Opravdu odstranit celý celek?")) return;

    delete data.celky[celekId];
    data.celkyOrder = data.celkyOrder.filter(id => id !== celekId);

    recalcNextCelekId();
    render();
}



function addPolozka(celekId) {
    const celek = data.celky[celekId];
    const pid = celek.nextPolozkaId++;

    celek.polozky[pid] = {
        name: "Nová položka",
		ignored: false,
        material: "",
        a: 0,
        b: 0,
        v: 0,
        pl: 0,
        ob: 0,
		unitFactor: 1,   // např. 1.7 t / m3
		namerFactor: 1,  // 1 = 0 %, 1.1 = +10 %
        cena: {
            nakupkaUnit: 0,
            ursUnit: 0,
            firmaUnit: 0,
            nakupkaTotal: 0,
            ursTotal: 0,
            firmaTotal: 0,
            priceFromM2: true
        }
    };

    render();
}


function deletePolozka(cid, pid) {
    delete data.celky[cid].polozky[pid];
    render();
}

render();




// PŘESUNY
function movePolozkaUp(celekId, pid) {
    const polozky = data.celky[celekId].polozky;
    const keys = Object.keys(polozky);
    const index = keys.indexOf(pid);
    if (index > 0) {
        // přehodit klíče
        [polozky[keys[index - 1]], polozky[keys[index]]] = 
        [polozky[keys[index]], polozky[keys[index - 1]]];
        render();
    }
}

function movePolozkaDown(celekId, pid) {
    const polozky = data.celky[celekId].polozky;
    const keys = Object.keys(polozky);
    const index = keys.indexOf(pid);
    if (index < keys.length - 1) {
        [polozky[keys[index]], polozky[keys[index + 1]]] =
        [polozky[keys[index + 1]], polozky[keys[index]]];
        render();
    }
}

function moveCelekUp(celekId) {
    const i = data.celkyOrder.indexOf(celekId);
    if (i > 0) {
        [data.celkyOrder[i - 1], data.celkyOrder[i]] =
        [data.celkyOrder[i], data.celkyOrder[i - 1]];
        render();
    }
}


function moveCelekDown(celekId) {
    const i = data.celkyOrder.indexOf(celekId);
    if (i < data.celkyOrder.length - 1) {
        [data.celkyOrder[i + 1], data.celkyOrder[i]] =
        [data.celkyOrder[i], data.celkyOrder[i + 1]];
        render();
    }
}



function saveData() {
    // vezmeme název souboru z textového pole
    const fileNameInput = document.getElementById("saveFileName");
    let fileName = fileNameInput.value.trim();  // bereme skutečnou hodnotu
    if (!fileName) fileName = "kalkulacka";    // default
    if (!fileName.endsWith(".json")) fileName += ".json";

    // Deep copy objektu data, aby se nezměnily reference
    const dataToSave = JSON.parse(JSON.stringify(data));

    // Ujistíme se, že nextPolozkaId u každého celku je uloženo
    Object.keys(dataToSave.celky).forEach(celekId => {
        const celek = dataToSave.celky[celekId];
        if (celek.nextPolozkaId === undefined) celek.nextPolozkaId = 1;
    });

    // Vytvoření blobu a stažení
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url);
}


// SAVE and LOAD 
function saveDataServer() {
    const fileNameInput = document.getElementById("saveFileName");
    let fileName = fileNameInput.value.trim();
    if (!fileName) fileName = "kalkulacka";

    fetch("/save-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fileName: fileName,
            content: {
                ...data,
                celkyOrder: data.celkyOrder || Object.keys(data.celky)
            }
        })
    })
    .then(res => res.json())
    .then(res => {
        if (res.status === "ok") {
            alert("Soubor uložen: " + res.path);
        } else {
            alert("Chyba při ukládání JSONu");
        }
    })
    .catch(err => {
        console.error(err);
        alert("Chyba při ukládání JSONu");
    });
}




function loadJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    fetch("/load-json", {
        method: "POST",
        body: formData
    })
    .then(res => res.json())
    .then(res => {
        if (res.status === "ok") {

            // 🔹 1) nahradíme stávající data
            data = res.content;

            // 🔹 2) zajistíme pořadí celků (DŮLEŽITÉ!)
            if (!data.celkyOrder) {
                data.celkyOrder = Object.keys(data.celky || {});
            }

            // 🔁 3) dopočet technických ID po loadu
            recalcNextCelekId();
            recalcNextPolozkaId();

            // 🔹 4) render + globální přepočty
            render();
            recalcGlobalCeny();
            renderGlobalCeny();

            alert("JSON načten: " + file.name);
        } else {
            alert("Chyba při načítání JSONu: " + res.message);
        }
    })
    .catch(err => {
        console.error(err);
        alert("Chyba při načítání JSONu");
    });

    // reset file input, aby šlo načíst stejný soubor znovu
    event.target.value = "";
}



function savePartialData(colorKey) {
    if (!colorKey) return alert("Zadej barvu pro export!");

    // vytvoříme objekt jen pro vybranou barvu
    const partial = {};
    partial[colorKey] = data[colorKey]; // předpoklad: struktura data[color]

    const blob = new Blob([JSON.stringify(partial, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `kalkulacka_${colorKey}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


function exportBarvaJSON(celekId) {
    const celek = data.celky[celekId];
    if (!celek || !celek.color) {
        alert("Nepodařilo se najít barvu celku.");
        return;
    }

    const barva = celek.color;

    const fileName = prompt(
        "Zadej název exportu:",
        "export_barva.json"
    );
    if (!fileName) return;

    // 🔹 vybereme celky dané barvy
    const exportedCelky = {};
    const exportedOrder = [];

    (data.celkyOrder || Object.keys(data.celky)).forEach(cid => {
        const c = data.celky[cid];
        if (c && c.color === barva) {
            exportedCelky[cid] = c;
            exportedOrder.push(cid);
        }
    });

    const exportPayload = {
        celky: exportedCelky,
        celkyOrder: exportedOrder
    };

    fetch("/save-partial-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fileName,
            content: exportPayload
        })
    })
    .then(res => res.json())
    .then(res => {
        if (res.status === "ok") {
            alert("Parciální export uložen: " + res.path);
        } else {
            alert("Chyba při exportu");
        }
    })
    .catch(err => {
        console.error(err);
        alert("Chyba při parciálním exportu");
    });
}




async function importBarvaJSON(celekId) {
    const celek = data.celky[celekId];
    if (!celek || !celek.color) {
        alert("Nepodařilo se najít barvu tohoto celku.");
        return;
    }

    const barva = celek.color;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/load-partial-json", {
            method: "POST",
            body: formData
        });

        const result = await res.json();
        if (result.status !== "ok") {
            alert("Chyba při načítání: " + result.message);
            return;
        }

        const importedCelky = Object.values(result.content.celky || {});
        if (!importedCelky.length) {
            alert("Soubor neobsahuje žádné celky");
            return;
        }

        recalcNextCelekId();

        const insertIndex = data.celkyOrder.indexOf(celekId);
        const newlyAddedIds = [];

        importedCelky.forEach((c, i) => {
            const newId = String(nextCelekId++);
            c.color = barva;

            data.celky[newId] = structuredClone(c);
            data.celkyOrder.splice(insertIndex + 1 + i, 0, newId);

            newlyAddedIds.push(newId);
        });

        recalcNextCelekId();
        recalcNextPolozkaId();

        render(newlyAddedIds);
        recalcGlobalCeny();
        renderGlobalCeny();

        alert("Parciální import dokončen!");
    };

    input.click();
}




function copyPolozka(celekId, pid) {
    const celek = data.celky[celekId];
    const orig = celek.polozky[pid];
    
    // nový pid
    const newPid = celek.nextPolozkaId++;
    
    // vytvořit novou položku s kopírovanými hodnotami
    celek.polozky[newPid] = JSON.parse(JSON.stringify(orig));
    
    // přepočet součtů a render
    recalcPolozka(celekId, newPid);
    recalcCelek(celekId);
    recalcGlobalCeny();
    render();
}

function copyCelek(celekId) {
    const original = data.celky[celekId];
    if (!original) return;

    const newId = String(nextCelekId++);
    const newCelek = JSON.parse(JSON.stringify(original));

    newCelek.polozky = {}; // nové položky budou kopie původních
    Object.keys(original.polozky).forEach(pid => {
        const p = original.polozky[pid];
        newCelek.polozky[pid] = JSON.parse(JSON.stringify(p));
    });

    newCelek.nextPolozkaId = original.nextPolozkaId || 1;

    data.celky[newId] = newCelek;
    data.celkyOrder.push(newId);

    render([newId]);
}










function changeCelekColor(celekId, color) {
    data.celky[celekId].color = color;
    render(); // render MUSÍ jet z dat
}


// MATERIALY 
function loadMaterials() {
    fetch("/materials")
        .then(r => r.json())
        .then(data => {
            materials = data;
            renderMaterialTable();
            refreshMaterialSelects(); // 🔁 důležité
        });
}

window.addEventListener("DOMContentLoaded", loadMaterials);

function renderMaterialTable() {
    const tbody = document.querySelector("#material-table tbody");
    tbody.innerHTML = "";

    Object.entries(materials)
        .sort(([a], [b]) => a.localeCompare(b, 'cs'))
        .forEach(([id, mat]) => {

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${id}</td>

                <td>
                    <input 
                        value="${mat.name}"
                        onchange="materials['${id}'].name = this.value"
                    >
                </td>

                <td>
                    <input 
                        type="number"
                        step="0.01"
                        value="${mat.unitCenaDefault}"
                        onchange="materials['${id}'].unitCenaDefault = parseFloat(this.value) || 0"
                    >
                </td>

                <td>
                    <button onclick="deleteMaterial('${id}')">❌</button>
                </td>
            `;

            tbody.appendChild(tr);
        });
}



function addMaterial() {
    const id = newMatId.value.trim();
    const name = newMatName.value.trim();
    const cena = Number(newMatCena.value);

    if (!id || !name) {
        alert("Vyplň ID a název");
        return;
    }

    if (materials[id]) {
        alert("Materiál s tímto ID už existuje");
        return;
    }

    // Přidání nového materiálu
    materials[id] = {
        name,
        unitCenaDefault: cena || 0
    };

    // 🔹 Seřazení objektu podle klíčů
    materials = Object.fromEntries(
        Object.entries(materials).sort(([a], [b]) => a.localeCompare(b))
    );

    // 🔹 Aktualizace tabulky a selectů
    renderMaterialTable();
    refreshMaterialSelects();
}



function deleteMaterial(id) {
    if (!confirm("Opravdu smazat materiál?")) return;
    delete materials[id];
    renderMaterialTable();
    refreshMaterialSelects();
}

function saveMaterials() {
    const sorted = Object.fromEntries(
        Object.entries(materials)
            .sort(([a], [b]) => a.localeCompare(b, 'cs'))
    );

    fetch("/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sorted, null, 2)
    })
    .then(r => r.json())
    .then(() => {
        materials = sorted;          // 🔥 důležité
        alert("Materiály uloženy");
        renderMaterialTable();
        refreshMaterialSelects();
    });
}



function refreshMaterialSelects() {
    document.querySelectorAll("select[data-celek][data-polozka]").forEach(sel => {
        const ce = sel.dataset.celek;
        const po = sel.dataset.polozka;
        const current = data.celky[ce].polozky[po].material;
        sel.innerHTML = renderMaterials(current);
    });
}


let materialsCollapsed = false;
/*
function toggleMaterials() {
    materialsCollapsed = !materialsCollapsed;

    const section = document.getElementById("material-manager");
    const btn = document.getElementById("materialsToggleBtn");

    section.style.display = materialsCollapsed ? "none" : "block";
    btn.textContent = materialsCollapsed ? "Správa materiálů" : "Zavřít správu materiálů";
}
*/


function toggleMaterials() {
    materialsCollapsed = !materialsCollapsed;

    const section = document.getElementById("material-manager");
    const btn = document.getElementById("materialsToggleBtn");

    if (materialsCollapsed) {
        section.style.display = "none";
        btn.textContent = "Správa materiálů";
    } else {
        section.style.display = "block";
        btn.textContent = "Zavřít správu materiálů";
    }
}




