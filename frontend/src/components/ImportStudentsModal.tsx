import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Upload, X, XCircle } from "lucide-react";
import toast from "react-hot-toast";

import { Modal } from "@/components/Modal";
import { useImportStudents } from "@/lib/queries";
import type { ImportReport, ImportRowResult } from "@/types/api";

interface Props {
  onClose: () => void;
}

const LEVELS = ["L1", "L2", "L3", "M1", "M2"] as const;

export function ImportStudentsModal({ onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [isDryRun, setIsDryRun] = useState(true);
  const [autoCreate, setAutoCreate] = useState(true);
  const [defaultLevel, setDefaultLevel] = useState<string>("L1");
  const inputRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportStudents();

  async function runImport(dryRun: boolean) {
    if (!file) {
      toast.error("Sélectionnez un fichier .xlsx");
      return;
    }
    if (autoCreate && !defaultLevel) {
      toast.error("Choisis le niveau des classes auto-créées");
      return;
    }
    setIsDryRun(dryRun);
    try {
      const result = await importMutation.mutateAsync({
        file,
        dryRun,
        autoCreateClasses: autoCreate,
        defaultLevel: autoCreate ? defaultLevel : undefined,
      });
      setReport(result);
      if (!dryRun) {
        toast.success(
          `${result.created} étudiant(s) importé(s), ${result.skipped} ignoré(s), ${result.errors} erreur(s)`
        );
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur lors de l'import");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setReport(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.toLowerCase().endsWith(".xlsx")) {
      setFile(f);
      setReport(null);
    } else {
      toast.error("Seuls les fichiers .xlsx sont acceptés");
    }
  }

  return (
    <Modal open onClose={onClose} width={780} fitViewport>
      {/* ─── HEADER (sticky) ─── */}
      <div
        style={{
          padding: "20px 28px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--navy-900)" }}>
            Importer des étudiants
          </h3>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Fichier Excel ESATIC — une feuille par classe.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
          <X size={16} />
        </button>
      </div>

      {/* ─── BODY (scrollable) ─── */}
      <div style={{ padding: "20px 28px", overflowY: "auto", flex: 1, minHeight: 0 }}>
        <FormatHelp />

        {/* Drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${file ? "var(--orange-500)" : "var(--border-strong)"}`,
            borderRadius: "var(--r-lg)",
            padding: 28,
            textAlign: "center",
            background: file ? "var(--orange-50)" : "var(--surface-2)",
            cursor: "pointer",
            transition: "all 160ms ease",
            marginTop: 14,
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <FileSpreadsheet
            size={32}
            style={{
              color: file ? "var(--orange-600)" : "var(--ink-400)",
              margin: "0 auto",
            }}
          />
          <div style={{ marginTop: 12, fontSize: 14, color: "var(--navy-900)", fontWeight: 500 }}>
            {file ? file.name : "Cliquez ou glissez le fichier .xlsx ici"}
          </div>
          {file && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {(file.size / 1024).toFixed(1)} Ko
            </div>
          )}
        </div>

        {/* Options auto-création des classes */}
        <div
          style={{
            marginTop: 14,
            padding: 14,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              fontSize: 13,
              color: "var(--navy-900)",
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={autoCreate}
              onChange={(e) => setAutoCreate(e.target.checked)}
            />
            Créer automatiquement les classes manquantes
          </label>
          {autoCreate && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--ink-700)" }}>
                Niveau à appliquer (toutes les feuilles de ce fichier) :
              </span>
              <select
                value={defaultLevel}
                onChange={(e) => setDefaultLevel(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border-strong)",
                  background: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--navy-900)",
                  cursor: "pointer",
                }}
              >
                {LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
              <span className="muted" style={{ fontSize: 12 }}>
                (sélectionne L1 pour LICENCE 1, M1 pour MASTER 1, etc.)
              </span>
            </div>
          )}
        </div>

        {/* Report */}
        {report && <ImportReportView report={report} dryRun={isDryRun} />}
      </div>

      {/* ─── FOOTER (sticky) ─── */}
      <div
        style={{
          padding: "16px 28px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface-2)",
          display: "flex",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <button type="button" className="btn btn-outline" onClick={onClose} style={{ flex: "0 0 auto" }}>
          Fermer
        </button>
        {!report || isDryRun ? (
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => runImport(true)}
              disabled={!file || importMutation.isPending}
              style={{ flex: 1 }}
            >
              {importMutation.isPending && isDryRun ? "Analyse…" : "Aperçu (dry-run)"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => runImport(false)}
              disabled={!file || importMutation.isPending}
              style={{ flex: 1 }}
            >
              <Upload size={14} />
              {importMutation.isPending && !isDryRun ? "Import…" : "Importer pour de vrai"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            Terminer
          </button>
        )}
      </div>
    </Modal>
  );
}

function FormatHelp() {
  return (
    <details
      style={{
        background: "var(--navy-50)",
        border: "1px solid var(--navy-100)",
        borderRadius: "var(--r-md)",
        padding: "10px 14px",
        fontSize: 13,
        color: "var(--ink-700)",
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--navy-900)" }}>
        Format attendu du fichier Excel
      </summary>
      <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.6 }}>
        <li>
          Une feuille <strong>par classe</strong> — le nom de la feuille doit correspondre
          au libellé de la classe en base (ex : <code>MP2I A</code>, <code>SRIT 1B</code>,
          <code> L3 Génie Logiciel</code>).
        </li>
        <li>
          La classe doit déjà exister dans le système (sinon créez-la dans{" "}
          <em>Classes</em> avant d'importer).
        </li>
        <li>
          Colonnes détectées automatiquement (insensibles casse/accents/pluriel) :
          <ul style={{ marginTop: 4, paddingLeft: 18 }}>
            <li>
              <code>matricule</code> — format <code>XX-ESATICNNNNAA</code>
              {" "}(ex <code>25-ESATIC0676AA</code>)
            </li>
            <li>
              <code>nom</code> / <code>noms</code>
            </li>
            <li>
              <code>prénom</code> / <code>prenoms</code>
            </li>
            <li>
              <code>genre</code> / <code>sexe</code> — optionnel
            </li>
          </ul>
        </li>
        <li>
          Un en-tête institutionnel (ministère, secrétariat…) avant la ligne de colonnes
          est <strong>toléré</strong> — le parser cherche automatiquement la ligne contenant
          "matricule" dans les 20 premières lignes.
        </li>
        <li>
          Les étudiants importés devront <strong>s'inscrire eux-mêmes</strong> avec leur
          matricule pour activer leur compte.
        </li>
      </ul>
    </details>
  );
}

function ImportReportView({ report, dryRun }: { report: ImportReport; dryRun: boolean }) {
  return (
    <div className="card" style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 18px",
          background: dryRun ? "var(--warn-50)" : "var(--success-50)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 16,
          fontSize: 13,
          fontWeight: 500,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "var(--ink-700)" }}>
          {dryRun ? "🔍 Aperçu (rien enregistré)" : "✓ Import effectué"}
        </span>
        <span style={{ color: "var(--success-600)" }}>{report.created} créés</span>
        <span style={{ color: "var(--ink-500)" }}>{report.skipped} ignorés</span>
        <span style={{ color: "var(--danger-600)" }}>{report.errors} erreurs</span>
        <span style={{ color: "var(--ink-500)", marginLeft: "auto" }}>
          {report.rows.length} ligne(s) analysée(s)
        </span>
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {report.rows.map((r: ImportRowResult, i: number) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "28px 50px 170px 1fr",
              gap: 12,
              padding: "8px 18px",
              borderBottom: "1px solid var(--border)",
              fontSize: 12,
              alignItems: "center",
              background:
                r.status === "error"
                  ? "rgba(239, 68, 68, 0.04)"
                  : r.status === "skipped"
                  ? "rgba(100, 116, 139, 0.04)"
                  : "transparent",
            }}
          >
            <div>
              {r.status === "ok" && (
                <CheckCircle2 size={14} style={{ color: "var(--success-500)" }} />
              )}
              {r.status === "skipped" && (
                <span style={{ color: "var(--ink-400)", fontSize: 16 }}>—</span>
              )}
              {r.status === "error" && (
                <XCircle size={14} style={{ color: "var(--danger-500)" }} />
              )}
            </div>
            <div className="muted" style={{ fontSize: 11 }}>
              L.{r.row}
            </div>
            <div className="mono" style={{ color: "var(--navy-900)", fontSize: 11 }}>
              {r.matricule || "—"}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {r.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
