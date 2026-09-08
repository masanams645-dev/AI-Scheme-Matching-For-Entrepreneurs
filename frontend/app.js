let schemeResults = [];

const $ = (id) => document.getElementById(id);

const demoBtn = $("demo");
const form = $("form");
const loading = $("loading");
const resultsSection = $("results");
const count = $("count");
const search = $("search");
const filter = $("filter");
const cards = $("cards");

const nameInput = $("name");
const stateInput = $("state");
const categoryInput = $("category");
const ageInput = $("age");
const incomeInput = $("income");
const businessInput = $("business");
const stageInput = $("stage");
const loanInput = $("loan");

const womenInput = $("women");
const disabilityInput = $("disability");
const ruralInput = $("rural");

const modal = $("modal");
const details = $("details");

const s1 = $("s1");
const s2 = $("s2");
const s3 = $("s3");


/* LOAD DEMO */
demoBtn.onclick = () => {
    nameInput.value = "Ravi";
    stateInput.value = "Tamil Nadu";
    categoryInput.value = "SC";
    ageInput.value = 28;
    incomeInput.value = 200000;
    businessInput.value = "Food";
    stageInput.value = "Existing";
    loanInput.value = 500000;
    ruralInput.checked = true;
};


/* FORM SUBMIT */
form.onsubmit = async (e) => {
    e.preventDefault();

    loading.classList.remove("hidden");
    resultsSection.classList.add("hidden");

    try {
        await new Promise(resolve => setTimeout(resolve, 900));

        const profile = {
            name: nameInput.value,
            state: stateInput.value,
            category: categoryInput.value,
            age: Number(ageInput.value),
            annual_income: Number(incomeInput.value),
            business_type: businessInput.value,
            business_stage: stageInput.value,
            loan_amount: Number(loanInput.value),
            women_entrepreneur: womenInput.checked,
            disability: disabilityInput.checked,
            rural: ruralInput.checked
        };

        const response = await fetch("/api/match", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(profile)
        });

        if (!response.ok) {
            throw new Error("Server returned " + response.status);
        }

        const data = await response.json();

        schemeResults = data.results || [];

        loading.classList.add("hidden");
        showResults();

    } catch (error) {
        loading.classList.add("hidden");

        alert(
            "Something went wrong.\n\n" +
            error.message
        );

        console.error(error);
    }
};


/* SHOW RESULTS */
function showResults() {

    resultsSection.classList.remove("hidden");

    count.textContent =
        schemeResults.length + " schemes analyzed";

    renderResults();
    loadStats();

    resultsSection.scrollIntoView({
        behavior: "smooth"
    });
}


/* RENDER RESULTS */
function renderResults() {

    const query = search.value.toLowerCase();
    const selectedFilter = filter.value;

    let list = schemeResults.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
    );

    if (selectedFilter === "eligible") {
        list = list.filter(item => item.eligible);
    }

    if (selectedFilter === "high") {
        list = list.filter(
            item => item.match_percentage >= 80
        );
    }

    cards.innerHTML = list.map(item => {

        const reasons = item.reasons
            .slice(0, 3)
            .map(reason =>
                `<span class="chip">✓ ${reason}</span>`
            )
            .join("");

        const warnings = item.warnings
            .slice(0, 2)
            .map(warning =>
                `<span class="warn">⚠ ${warning}</span>`
            )
            .join("");

        return `
            <article class="card">

                <div style="display:flex;justify-content:space-between">

                    <div>
                        <small>
                            ${item.eligible
                                ? "LIKELY ELIGIBLE"
                                : "REVIEW NEEDED"}
                        </small>

                        <h3>${item.name}</h3>
                    </div>

                    <div class="score">
                        ${item.match_percentage}%
                    </div>

                </div>

                <div class="meter">
                    <i style="width:${item.match_percentage}%"></i>
                </div>

                <p class="muted">
                    ${item.description}
                </p>

                ${reasons}

                ${warnings}

                <p class="muted">
                    AI confidence: ${item.confidence}%
                </p>

                <div class="actions">

                    <button onclick='showExplanation(${JSON.stringify(item)})'>
                        View Explanation
                    </button>

                    <a
                        class="primary"
                        target="_blank"
                        href="${item.official_url}">
                        Official Portal
                    </a>

                </div>

            </article>
        `;

    }).join("");
}


/* SEARCH + FILTER */
search.oninput = renderResults;
filter.onchange = renderResults;


/* EXPLANATION MODAL */
function showExplanation(item) {

    details.innerHTML = `

        <h2>${item.name}</h2>

        <p class="muted">
            ${item.description}
        </p>

        <h3>Why it matches</h3>

        <ul>
            ${item.reasons
                .map(reason => `<li>${reason}</li>`)
                .join("")}
        </ul>

        ${
            item.warnings.length
                ? `
                    <h3>Verify these</h3>

                    <ul>
                        ${item.warnings
                            .map(warning => `<li>${warning}</li>`)
                            .join("")}
                    </ul>
                `
                : ""
        }

        <h3>Purpose</h3>

        <p>
            ${item.purpose}
        </p>

        <h3>Maximum sample support</h3>

        <p>
            <b>
                ₹${item.max_support.toLocaleString("en-IN")}
            </b>
        </p>

        <h3>Documents</h3>

        <ul>
            ${item.documents
                .map(document => `<li>${document}</li>`)
                .join("")}
        </ul>

        <h3>Next steps</h3>

        <ol>
            ${item.next_steps
                .map(step => `<li>${step}</li>`)
                .join("")}
        </ol>

        <p>
            <b>
                Match: ${item.match_percentage}%
                |
                Confidence: ${item.confidence}%
            </b>
        </p>

        <a
            class="primary"
            target="_blank"
            href="${item.official_url}">
            Open Official Information
        </a>

        <p>
            Was this recommendation useful?
        </p>

        <button onclick="feedback('${item.id}', 5)">
            👍 Yes
        </button>

        <button onclick="feedback('${item.id}', 2)">
            👎 No
        </button>
    `;

    modal.classList.remove("hidden");
}


/* CLOSE MODAL */
function closeModal() {
    modal.classList.add("hidden");
}


/* FEEDBACK */
async function feedback(id, rating) {

    await fetch("/api/feedback", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            scheme_id: id,
            rating: rating,
            comment: "Demo feedback"
        })
    });

    alert("Feedback saved");

    closeModal();

    loadStats();
}


/* LOAD DASHBOARD STATS */
async function loadStats() {

    try {

        const response = await fetch("/api/stats");

        const data = await response.json();

        s1.textContent = data.schemes;
        s2.textContent = data.searches;
        s3.textContent = data.feedback;

    } catch (error) {

        console.error(
            "Stats loading failed:",
            error
        );

    }
}


/* START */
loadStats();