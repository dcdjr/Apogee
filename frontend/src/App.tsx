import { useEffect, useMemo, useState } from "react";
import "./App.css";

type AnalysisResult = {
    micro_win_title: string;
    short_summary: string;
    skills_learned: string[];
    next_step: string;
};

type SavedEntry = AnalysisResult & {
    id: number;
    raw_text: string;
    created_at: string;
};

type SkillReport = {
    headline: string;
    progress_summary: string;
    top_skills: string[];
    evidence: string[];
    recommended_next_steps: string[];
    portfolio_blurb: string;
};

type Page = "capture" | "ledger" | "report";
type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "skillvault-theme";
const LEGACY_THEME_STORAGE_KEY = "proof-of-skill-theme";
const API_URL = `http://${window.location.hostname}:8000`;

async function getErrorMessage(response: Response, fallback: string) {
    try {
        const data = (await response.json()) as { detail?: string };
        return data.detail || fallback;
    } catch {
        return fallback;
    }
}

function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(date));
}

function App() {
    const [theme, setTheme] = useState<Theme>(() => {
        const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
            ?? window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
        if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
        return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    });
    const [page, setPage] = useState<Page>("capture");
    const [text, setText] = useState("");
    const [analyzedText, setAnalyzedText] = useState("");
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [savedEntry, setSavedEntry] = useState<SavedEntry | null>(null);
    const [wins, setWins] = useState<SavedEntry[]>([]);
    const [isLoadingWins, setIsLoadingWins] = useState(false);
    const [winsError, setWinsError] = useState("");
    const [ledgerSearch, setLedgerSearch] = useState("");
    const [activeSkill, setActiveSkill] = useState<string | null>(null);
    const [selectedWinId, setSelectedWinId] = useState<number | null>(null);
    const [showGraphLabels, setShowGraphLabels] = useState(true);
    const [report, setReport] = useState<SkillReport | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportError, setReportError] = useState("");
    const [isBlurbCopied, setIsBlurbCopied] = useState(false);
    const [copyError, setCopyError] = useState("");

    async function loadWins() {
        setIsLoadingWins(true);
        setWinsError("");

        try {
            const response = await fetch(`${API_URL}/api/wins`);
            if (!response.ok) {
                throw new Error(await getErrorMessage(response, "Could not load wins."));
            }
            setWins((await response.json()) as SavedEntry[]);
        } catch (error) {
            setWinsError(
                error instanceof Error ? error.message : "Could not load your ledger.",
            );
        } finally {
            setIsLoadingWins(false);
        }
    }

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    }, [theme]);

    useEffect(() => {
        if (page === "ledger" || page === "report") void loadWins();
    }, [page]);

    const skillStats = useMemo(() => {
        const skills = new Map<string, { name: string; count: number }>();

        wins.forEach((win) => {
            win.skills_learned.forEach((skill) => {
                const name = skill.trim();
                const key = name.toLocaleLowerCase();
                if (!name) return;

                const existing = skills.get(key);
                skills.set(key, {
                    name: existing?.name ?? name,
                    count: (existing?.count ?? 0) + 1,
                });
            });
        });

        return [...skills.values()].sort(
            (left, right) => right.count - left.count || left.name.localeCompare(right.name),
        );
    }, [wins]);

    const filteredWins = useMemo(() => {
        const query = ledgerSearch.trim().toLocaleLowerCase();

        return wins.filter((win) => {
            const matchesSkill = activeSkill
                ? win.skills_learned.some(
                    (skill) => skill.trim().toLocaleLowerCase() === activeSkill.toLocaleLowerCase(),
                )
                : true;
            const searchableText = [
                win.micro_win_title,
                win.short_summary,
                win.raw_text,
                ...win.skills_learned,
            ]
                .join(" ")
                .toLocaleLowerCase();

            return matchesSkill && (!query || searchableText.includes(query));
        });
    }, [activeSkill, ledgerSearch, wins]);

    const selectedWin = useMemo(
        () => filteredWins.find((win) => win.id === selectedWinId) ?? null,
        [filteredWins, selectedWinId],
    );

    useEffect(() => {
        if (filteredWins.length === 0) {
            if (selectedWinId !== null) setSelectedWinId(null);
            return;
        }

        if (!filteredWins.some((win) => win.id === selectedWinId)) {
            setSelectedWinId(filteredWins[0].id);
        }
    }, [filteredWins, selectedWinId]);

    const graphData = useMemo(() => {
        const width = 920;
        const height = 640;
        const centerX = width / 2;
        const centerY = height / 2;
        const skillMap = new Map<string, { name: string; count: number }>();

        filteredWins.forEach((win) => {
            win.skills_learned.forEach((skill) => {
                const name = skill.trim();
                const key = name.toLocaleLowerCase();
                if (!name) return;
                const existing = skillMap.get(key);
                skillMap.set(key, { name: existing?.name ?? name, count: (existing?.count ?? 0) + 1 });
            });
        });

        const skills = [...skillMap.values()].sort(
            (left, right) => right.count - left.count || left.name.localeCompare(right.name),
        );
        const skillNodes = skills.map((skill, index) => {
            const angle = -Math.PI / 2 + (index / Math.max(skills.length, 1)) * Math.PI * 2;
            const radius = 205 + (index % 3) * 42;
            return {
                id: `skill-${skill.name.toLocaleLowerCase()}`,
                kind: "skill" as const,
                label: skill.name,
                count: skill.count,
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius * 0.78,
            };
        });
        const skillPositions = new Map(
            skillNodes.map((node) => [node.label.toLocaleLowerCase(), node]),
        );
        const winNodes = filteredWins.map((win, index) => {
            const linkedSkills = win.skills_learned
                .map((skill) => skillPositions.get(skill.trim().toLocaleLowerCase()))
                .filter((node): node is (typeof skillNodes)[number] => Boolean(node));
            const anchorX = linkedSkills.length
                ? linkedSkills.reduce((sum, node) => sum + node.x, 0) / linkedSkills.length
                : centerX;
            const anchorY = linkedSkills.length
                ? linkedSkills.reduce((sum, node) => sum + node.y, 0) / linkedSkills.length
                : centerY;
            const angle = index * 2.399963229728653;
            const spread = 42 + (index % 5) * 13;

            return {
                id: `win-${win.id}`,
                kind: "win" as const,
                win,
                label: win.micro_win_title,
                x: anchorX * 0.64 + centerX * 0.36 + Math.cos(angle) * spread,
                y: anchorY * 0.64 + centerY * 0.36 + Math.sin(angle) * spread,
            };
        });
        const winPositions = new Map(winNodes.map((node) => [node.win.id, node]));
        const edges = filteredWins.flatMap((win) => {
            const source = winPositions.get(win.id);
            if (!source) return [];
            return win.skills_learned.flatMap((skill) => {
                const target = skillPositions.get(skill.trim().toLocaleLowerCase());
                return target ? [{ id: `${win.id}-${target.id}`, source, target }] : [];
            });
        });

        return { width, height, skillNodes, winNodes, edges };
    }, [filteredWins]);

    const mostCommonSkill = skillStats[0]?.name ?? "None yet";
    const reportEvidenceCount = Math.min(wins.length, 10);
    const hasLedgerFilters = Boolean(ledgerSearch.trim() || activeSkill);

    function clearLedgerFilters() {
        setLedgerSearch("");
        setActiveSkill(null);
    }

    async function handleAnalyze(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const rawText = text.trim();
        if (!rawText) return;

        setText("");
        setIsAnalyzing(true);
        setAnalysisError("");
        setSaveError("");
        setSavedEntry(null);
        setResult(null);
        setAnalyzedText(rawText);

        try {
            const response = await fetch(`${API_URL}/api/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: rawText }),
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response, "Analysis failed."));
            }

            setResult((await response.json()) as AnalysisResult);
        } catch (error) {
            setAnalysisError(
                error instanceof Error
                    ? error.message
                    : "Could not analyze this win. Please try again.",
            );
        } finally {
            setIsAnalyzing(false);
        }
    }

    async function handleSave() {
        if (!result || !analyzedText || savedEntry) return;

        setIsSaving(true);
        setSaveError("");

        try {
            const response = await fetch(`${API_URL}/api/wins`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ raw_text: analyzedText, analysis: result }),
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response, "Save failed."));
            }

            setSavedEntry((await response.json()) as SavedEntry);
            setReport(null);
            setReportError("");
            setIsBlurbCopied(false);
            setCopyError("");
        } catch (error) {
            setSaveError(
                error instanceof Error
                    ? error.message
                    : "Could not save this win. Please try again.",
            );
        } finally {
            setIsSaving(false);
        }
    }

    async function handleGenerateReport() {
        if (wins.length === 0) return;

        setIsGeneratingReport(true);
        setReportError("");
        setIsBlurbCopied(false);
        setCopyError("");

        try {
            const response = await fetch(`${API_URL}/api/report`);
            if (!response.ok) {
                throw new Error(
                    await getErrorMessage(response, "Could not generate your skill report."),
                );
            }

            setReport((await response.json()) as SkillReport);
        } catch (error) {
            setReportError(
                error instanceof Error
                    ? error.message
                    : "Could not generate your skill report. Please try again.",
            );
        } finally {
            setIsGeneratingReport(false);
        }
    }

    async function handleCopyBlurb() {
        if (!report) return;

        try {
            await navigator.clipboard.writeText(report.portfolio_blurb);
            setCopyError("");
            setIsBlurbCopied(true);
            window.setTimeout(() => setIsBlurbCopied(false), 1800);
        } catch {
            const fallbackInput = document.createElement("textarea");
            fallbackInput.value = report.portfolio_blurb;
            fallbackInput.setAttribute("readonly", "");
            fallbackInput.style.position = "fixed";
            fallbackInput.style.opacity = "0";
            document.body.appendChild(fallbackInput);
            fallbackInput.select();
            const copied = document.execCommand("copy");
            fallbackInput.remove();

            if (copied) {
                setCopyError("");
                setIsBlurbCopied(true);
                window.setTimeout(() => setIsBlurbCopied(false), 1800);
            } else {
                setIsBlurbCopied(false);
                setCopyError("Could not copy automatically. Please select and copy the blurb manually.");
            }
        }
    }

    return (
        <main
            className={page === "ledger" ? "dashboard ledger-mode" : "dashboard"}
            data-theme={theme}
        >
            <nav className="top-nav" aria-label="Main navigation">
                <button className="brand" type="button" onClick={() => setPage("capture")}>
                    <span className="brand-mark" aria-hidden="true">S</span>
                    SkillVault
                </button>
                <div className="nav-actions">
                    <div className="nav-links">
                        <button
                            className={page === "capture" ? "nav-link active" : "nav-link"}
                            type="button"
                            onClick={() => setPage("capture")}
                        >
                            Capture
                        </button>
                        <button
                            className={page === "ledger" ? "nav-link active" : "nav-link"}
                            type="button"
                            onClick={() => setPage("ledger")}
                        >
                            My Ledger
                        </button>
                        <button
                            className={page === "report" ? "nav-link active" : "nav-link"}
                            type="button"
                            onClick={() => setPage("report")}
                        >
                            Skill Report
                        </button>
                    </div>
                    <button
                        className="theme-toggle"
                        type="button"
                        onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
                        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                        title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                    >
                        <span aria-hidden="true">{theme === "light" ? "Dark mode" : "Light mode"}</span>
                    </button>
                </div>
            </nav>

            {page === "capture" ? (
                <>
                    <header className="page-header">
                        <p className="eyebrow">FidHacks 2026</p>
                        <h1>Turn small wins into proof of growth.</h1>
                        <p className="intro">
                            Capture something you learned, solved, or accomplished today.
                        </p>
                    </header>

                    <div className="capture-layout">
                        <form className="entry-card" onSubmit={handleAnalyze}>
                            <label htmlFor="micro-win">What was your micro-win?</label>
                            <textarea
                                id="micro-win"
                                value={text}
                                onChange={(event) => setText(event.target.value)}
                                placeholder="Example: I finally figured out why my API request was failing..."
                                rows={9}
                            />
                            <button className="primary-button" type="submit" disabled={!text.trim() || isAnalyzing}>
                                {isAnalyzing ? "Analyzing..." : "Analyze my win"}
                            </button>
                            {analysisError && <p className="status-message error-message">{analysisError}</p>}
                        </form>

                        <section className="analysis-card" aria-live="polite">
                            <p className="card-label">Extracted Skill Evidence</p>
                            {!result && !isAnalyzing && (
                                <div className="empty-analysis">
                                    <span aria-hidden="true">AI</span>
                                    <p>Your analysis will appear here after you submit a micro-win.</p>
                                </div>
                            )}
                            {isAnalyzing && <p className="empty-state">Analyzing your win...</p>}
                            {result && (
                                <div className="analysis-content">
                                    <h2>{result.micro_win_title}</h2>
                                    <div><h3>Short summary</h3><p>{result.short_summary}</p></div>
                                    <div>
                                        <h3>Skills learned</h3>
                                        <ul className="skill-list">
                                            {result.skills_learned.map((skill) => <li key={skill}>{skill}</li>)}
                                        </ul>
                                    </div>
                                    <div><h3>Next step</h3><p>{result.next_step}</p></div>
                                </div>
                            )}
                            <div className="save-area">
                                <button
                                    className="primary-button"
                                    type="button"
                                    onClick={handleSave}
                                    disabled={!result || isSaving || Boolean(savedEntry)}
                                >
                                    {isSaving ? "Saving..." : savedEntry ? "Saved" : "Save evidence"}
                                </button>
                                <p className="save-helper">Saving adds this evidence note to your SkillVault.</p>
                                {savedEntry && <p className="status-message success-message">Saved to SkillVault.</p>}
                                {saveError && <p className="status-message error-message">{saveError}</p>}
                            </div>
                        </section>
                    </div>
                </>
            ) : page === "ledger" ? (
                <section className="ledger-page obsidian-ledger">
                    <header className="ledger-header">
                        <div>
                            <p className="eyebrow">SkillVault evidence graph</p>
                            <h1>My Ledger</h1>
                            <p className="intro">
                                Your ledger turns small learning moments into searchable evidence of skill growth.
                            </p>
                        </div>
                        <div className="ledger-stats" aria-label="Ledger summary">
                            <div className="ledger-stat"><strong>{wins.length}</strong><span>evidence notes</span></div>
                            <div className="ledger-stat"><strong>{skillStats.length}</strong><span>skill nodes</span></div>
                            <div className="ledger-stat"><strong>{mostCommonSkill}</strong><span>strongest signal</span></div>
                        </div>
                    </header>

                    {isLoadingWins && <div className="ledger-state dark-state">Loading your vault...</div>}

                    {winsError && (
                        <div className="ledger-state dark-state error-state">
                            <p>{winsError}</p>
                            <button className="secondary-button" type="button" onClick={() => void loadWins()}>
                                Try again
                            </button>
                        </div>
                    )}

                    {!isLoadingWins && !winsError && wins.length === 0 && (
                        <div className="ledger-state dark-state empty-ledger">
                            <span className="empty-icon" aria-hidden="true">+</span>
                            <h2>Your vault is ready for its first evidence note.</h2>
                            <p>Save a micro-win to begin connecting your learning moments into a skill network.</p>
                            <button className="primary-button" type="button" onClick={() => setPage("capture")}>
                                Capture a win
                            </button>
                        </div>
                    )}

                    {!isLoadingWins && !winsError && wins.length > 0 && (
                        <div className="obsidian-workspace">
                            <aside className="obsidian-explorer" aria-label="Vault explorer">
                                <div className="obsidian-pane-title">
                                    <span>Vault explorer</span>
                                    <small>{filteredWins.length}</small>
                                </div>
                                <label className="obsidian-search" htmlFor="ledger-search">
                                    <span aria-hidden="true">/</span>
                                    <input
                                        id="ledger-search"
                                        type="search"
                                        value={ledgerSearch}
                                        onChange={(event) => setLedgerSearch(event.target.value)}
                                        placeholder="Search vault..."
                                    />
                                </label>
                                {hasLedgerFilters && (
                                    <button className="obsidian-clear" type="button" onClick={clearLedgerFilters}>
                                        Clear search & filters
                                    </button>
                                )}

                                <div className="explorer-section">
                                    <p>Tags</p>
                                    <button
                                        className={activeSkill === null ? "obsidian-tag active" : "obsidian-tag"}
                                        type="button"
                                        onClick={() => setActiveSkill(null)}
                                    >
                                        <span># all-wins</span><small>{wins.length}</small>
                                    </button>
                                    <div className="obsidian-tag-list">
                                        {skillStats.map((skill) => (
                                            <button
                                                className={activeSkill === skill.name ? "obsidian-tag active" : "obsidian-tag"}
                                                type="button"
                                                key={skill.name}
                                                onClick={() => setActiveSkill(activeSkill === skill.name ? null : skill.name)}
                                            >
                                                <span># {skill.name}</span><small>{skill.count}</small>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="explorer-section evidence-files">
                                    <p>Evidence notes</p>
                                    {filteredWins.length === 0 ? (
                                        <div className="obsidian-no-results">
                                            <strong>No matching wins found</strong>
                                            <button type="button" onClick={clearLedgerFilters}>Reset vault</button>
                                        </div>
                                    ) : filteredWins.map((win) => (
                                        <button
                                            className={win.id === selectedWinId ? "obsidian-file active" : "obsidian-file"}
                                            type="button"
                                            key={win.id}
                                            onClick={() => setSelectedWinId(win.id)}
                                        >
                                            <span aria-hidden="true">-</span>
                                            <span>{win.micro_win_title}</span>
                                        </button>
                                    ))}
                                </div>
                            </aside>

                            <section className="graph-pane" aria-label="Skill evidence graph">
                                <div className="graph-tabbar">
                                    <div className="graph-tab"><span aria-hidden="true">G</span> Skill graph <small>x</small></div>
                                    <p className="graph-explanation">
                                        Skill nodes are extracted from saved wins. Evidence notes connect to the skills they demonstrate.
                                    </p>
                                    <div className="graph-actions">
                                        <span>{graphData.winNodes.length} notes</span>
                                        <span>{graphData.skillNodes.length} skills</span>
                                    </div>
                                </div>
                                <div className="graph-canvas">
                                    {filteredWins.length === 0 ? (
                                        <div className="graph-empty">
                                            <span aria-hidden="true">+</span>
                                            <h2>No matching wins found</h2>
                                            <p>Reset the vault to restore the full evidence network.</p>
                                            <button type="button" onClick={clearLedgerFilters}>Clear filters</button>
                                        </div>
                                    ) : (
                                        <svg
                                            className="skill-graph"
                                            viewBox={`0 0 ${graphData.width} ${graphData.height}`}
                                            role="img"
                                            aria-label="Connected graph of saved wins and demonstrated skills"
                                        >
                                            <defs>
                                                <radialGradient id="graphGlow">
                                                    <stop offset="0%" stopColor="#8f7cf7" stopOpacity="0.18" />
                                                    <stop offset="100%" stopColor="#8f7cf7" stopOpacity="0" />
                                                </radialGradient>
                                                <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
                                                    <feGaussianBlur stdDeviation="4" result="blur" />
                                                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                                </filter>
                                            </defs>
                                            <circle cx="460" cy="320" r="250" fill="url(#graphGlow)" />
                                            <g className="graph-edges">
                                                {graphData.edges.map((edge) => (
                                                    <line
                                                        key={edge.id}
                                                        x1={edge.source.x}
                                                        y1={edge.source.y}
                                                        x2={edge.target.x}
                                                        y2={edge.target.y}
                                                    />
                                                ))}
                                            </g>
                                            <g className="graph-win-nodes">
                                                {graphData.winNodes.map((node) => {
                                                    const isSelected = node.win.id === selectedWinId;
                                                    return (
                                                        <g
                                                            className={isSelected ? "graph-node win-node selected" : "graph-node win-node"}
                                                            key={node.id}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => setSelectedWinId(node.win.id)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter" || event.key === " ") setSelectedWinId(node.win.id);
                                                            }}
                                                        >
                                                            <circle cx={node.x} cy={node.y} r={isSelected ? 9 : 5.5} />
                                                            {showGraphLabels && isSelected && (
                                                                <text x={node.x + 13} y={node.y - 10}>{node.label}</text>
                                                            )}
                                                        </g>
                                                    );
                                                })}
                                            </g>
                                            <g className="graph-skill-nodes">
                                                {graphData.skillNodes.map((node, index) => {
                                                    const isActive = activeSkill?.toLocaleLowerCase() === node.label.toLocaleLowerCase();
                                                    return (
                                                        <g
                                                            className={isActive ? "graph-node skill-node active" : "graph-node skill-node"}
                                                            key={node.id}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => setActiveSkill(isActive ? null : node.label)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter" || event.key === " ") setActiveSkill(isActive ? null : node.label);
                                                            }}
                                                            style={{ "--node-hue": `${(index * 47 + 248) % 360}` } as React.CSSProperties}
                                                        >
                                                            <circle cx={node.x} cy={node.y} r={10 + Math.min(node.count, 6) * 1.6} />
                                                            {showGraphLabels && (
                                                                <text x={node.x + 16} y={node.y + 4}>{node.label}</text>
                                                            )}
                                                        </g>
                                                    );
                                                })}
                                            </g>
                                        </svg>
                                    )}
                                    <div className="graph-legend">
                                        <span><i className="legend-skill" /> Skill</span>
                                        <span><i className="legend-win" /> Evidence note</span>
                                    </div>
                                </div>
                            </section>

                            <aside className="obsidian-inspector" aria-label="Graph and note inspector">
                                <div className="obsidian-pane-title"><span>Inspector</span><small>...</small></div>
                                <section className="inspector-controls">
                                    <p>Display</p>
                                    <label className="toggle-row">
                                        <span>Show node labels</span>
                                        <input
                                            type="checkbox"
                                            checked={showGraphLabels}
                                            onChange={(event) => setShowGraphLabels(event.target.checked)}
                                        />
                                        <i aria-hidden="true" />
                                    </label>
                                    <p className="control-helper">Turn labels off when the graph gets crowded.</p>
                                    <div className="inspector-metric"><span>Visible links</span><strong>{graphData.edges.length}</strong></div>
                                    <div className="inspector-metric"><span>Latest note</span><strong>{wins[0].micro_win_title}</strong></div>
                                </section>

                                <section className="inspector-note">
                                    <p className="inspector-label">Selected evidence</p>
                                    {selectedWin ? (
                                        <article>
                                            <time dateTime={selectedWin.created_at}>{formatDate(selectedWin.created_at)}</time>
                                            <h2>{selectedWin.micro_win_title}</h2>
                                            <p className="inspector-summary">{selectedWin.short_summary}</p>
                                            <div className="inspector-tags">
                                                {selectedWin.skills_learned.map((skill) => <span key={skill}>#{skill}</span>)}
                                            </div>
                                            <div className="inspector-block">
                                                <h3>Next step</h3>
                                                <p>{selectedWin.next_step}</p>
                                            </div>
                                            <div className="inspector-block reflection">
                                                <h3>Evidence note</h3>
                                                <p>{selectedWin.raw_text}</p>
                                            </div>
                                        </article>
                                    ) : (
                                        <div className="inspector-placeholder">
                                            <span aria-hidden="true">+</span>
                                            <p>Select a node or evidence note to inspect it.</p>
                                        </div>
                                    )}
                                </section>
                            </aside>
                        </div>
                    )}
                </section>
            ) : (
                <section className="report-page">
                    <header className="report-header">
                        <div>
                            <p className="eyebrow">Skill report</p>
                            <h1>Your progress, made useful.</h1>
                            <p className="intro">
                                Generate a focused progress report from your saved evidence notes.
                            </p>
                            {!isLoadingWins && !winsError && wins.length > 0 && (
                                <p className="report-basis">
                                    Based on {reportEvidenceCount} saved {reportEvidenceCount === 1 ? "win" : "wins"} from your SkillVault.
                                </p>
                            )}
                        </div>
                        <button
                            className="primary-button report-button"
                            type="button"
                            onClick={() => void handleGenerateReport()}
                            disabled={isGeneratingReport || isLoadingWins || wins.length === 0}
                        >
                            {isGeneratingReport ? "Generating report..." : "Generate Skill Report"}
                        </button>
                    </header>

                    {isLoadingWins && (
                        <div className="report-state report-loading" aria-live="polite">
                            <span className="report-pulse" aria-hidden="true">...</span>
                            <h2>Checking your ledger</h2>
                            <p>Gathering the saved evidence notes that will shape your report.</p>
                        </div>
                    )}

                    {!isLoadingWins && winsError && (
                        <div className="report-state error-state" role="alert">
                            <h2>We could not load your ledger.</h2>
                            <p>{winsError}</p>
                            <button className="secondary-button" type="button" onClick={() => void loadWins()}>
                                Try again
                            </button>
                        </div>
                    )}

                    {!isLoadingWins && !winsError && wins.length === 0 && (
                        <div className="report-state report-empty-state">
                            <span className="report-pulse" aria-hidden="true">+</span>
                            <h2>Add evidence before generating a report.</h2>
                            <p>
                                Capture and save at least one learning win. Your report will use those ledger notes as its only evidence.
                            </p>
                            <button className="primary-button" type="button" onClick={() => setPage("capture")}>
                                Capture your first win
                            </button>
                        </div>
                    )}

                    {!isLoadingWins && !winsError && wins.length > 0 && isGeneratingReport && (
                        <div className="report-state report-loading" aria-live="polite">
                            <span className="report-pulse" aria-hidden="true">AI</span>
                            <h2>Building your progress snapshot</h2>
                            <p>Reviewing recurring skills, evidence, and practical next actions.</p>
                        </div>
                    )}

                    {!isLoadingWins && !winsError && wins.length > 0 && !isGeneratingReport && reportError && (
                        <div className="report-state error-state" role="alert">
                            <h2>We could not build the report yet.</h2>
                            <p>{reportError}</p>
                            <button
                                className="secondary-button"
                                type="button"
                                onClick={() => void handleGenerateReport()}
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {!isLoadingWins && !winsError && wins.length > 0 && !isGeneratingReport && !reportError && !report && (
                        <div className="report-state report-ready-state">
                            <span className="report-pulse" aria-hidden="true">{wins.length}</span>
                            <h2>Your evidence is ready.</h2>
                            <p>
                                Based on {reportEvidenceCount} saved {reportEvidenceCount === 1 ? "win" : "wins"} from your SkillVault.
                                Generate a concise artifact that connects your strongest skill signals to real examples.
                            </p>
                            <button
                                className="primary-button ready-report-button"
                                type="button"
                                onClick={() => void handleGenerateReport()}
                            >
                                Generate Skill Report
                            </button>
                        </div>
                    )}

                    {!isLoadingWins && !winsError && !isGeneratingReport && !reportError && report && (
                        <article className="report-card focused-report" aria-live="polite">
                            <section className="report-summary-card">
                                <div>
                                    <p className="card-label">Progress snapshot</p>
                                    <h2>{report.headline}</h2>
                                    <p>{report.progress_summary}</p>
                                </div>
                                <p className="report-source-note">
                                    Based on {reportEvidenceCount} saved {reportEvidenceCount === 1 ? "win" : "wins"} from your SkillVault
                                </p>
                            </section>

                            <section className="report-signal-row">
                                <div className="report-section-heading">
                                    <p className="card-label">Skill signals</p>
                                    <h3>What keeps showing up</h3>
                                </div>
                                <ul className="skill-list report-skill-list">
                                    {report.top_skills.map((skill) => <li key={skill}>{skill}</li>)}
                                </ul>
                            </section>

                            <div className="report-detail-grid">
                                <section className="report-evidence-section">
                                    <div className="report-section-heading">
                                        <p className="card-label">Ledger evidence</p>
                                        <h3>Proof behind the progress</h3>
                                    </div>
                                    <ul className="evidence-list">
                                        {report.evidence.map((item) => <li key={item}>{item}</li>)}
                                    </ul>
                                </section>

                                <section className="report-actions-section">
                                    <div className="report-section-heading">
                                        <p className="card-label">Next actions</p>
                                        <h3>Where to focus next</h3>
                                    </div>
                                    <ol className="action-list">
                                        {report.recommended_next_steps.map((item) => <li key={item}>{item}</li>)}
                                    </ol>
                                </section>
                            </div>

                            <section className="portfolio-artifact">
                                <div className="portfolio-heading">
                                    <div>
                                        <p className="card-label">Portfolio-ready blurb</p>
                                        <h3>Ready for LinkedIn, a resume, or your website</h3>
                                    </div>
                                    <button
                                        className="secondary-button copy-blurb-button"
                                        type="button"
                                        onClick={() => void handleCopyBlurb()}
                                    >
                                        {isBlurbCopied ? "Copied" : "Copy blurb"}
                                    </button>
                                </div>
                                <blockquote>{report.portfolio_blurb}</blockquote>
                                <p className={copyError ? "copy-feedback error-message" : "copy-feedback"} aria-live="polite">
                                    {copyError || (isBlurbCopied
                                        ? "Copied to clipboard."
                                        : "Edit the wording to match your voice before publishing.")}
                                </p>
                            </section>
                        </article>
                    )}
                </section>
            )}
        </main>
    );
}

export default App;
