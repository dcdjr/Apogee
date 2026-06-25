import { useState } from "react";
import "./App.css";

type AnalysisResult = {
    title: string;
    micro_win: string;
    skills: string[];
    breakthrough: string;
    growth_type: string;
    evidence: string;
    outcome: string;
};

function App() {
    const [text, setText] = useState("");
    const [result, setResult] = useState<AnalysisResult | null>(null);

    async function handleAnalyze() {
        const response = await fetch("http://localhost:8000/api/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text }),
        });

        const data = await response.json();
        setResult(data);
    }

    return (
        <main>
            <h1>PROJECT_NAME</h1>

            <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="What did you learn, build, or debug?"
            />

            <br />

            <button onClick={handleAnalyze}>Analyze</button>

            {result && (
                <section>
                    <h2>{result.title}</h2>
                    <p><strong>Micro-win:</strong> {result.micro_win}</p>
                    <p><strong>Breakthrough:</strong> {result.breakthrough}</p>
                    <p><strong>Growth type:</strong> {result.growth_type}</p>
                    <p><strong>Evidence:</strong> {result.evidence}</p>
                    <p><strong>Outcome:</strong> {result.outcome}</p>

                    <h3>Skills</h3>
                    <ul>
                        {result.skills.map((skill) => (
                            <li key={skill}>{skill}</li>
                        ))}
                    </ul>
                </section>
            )}
        </main>
    );
}

export default App;
