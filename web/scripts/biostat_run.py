"""
Inferential statistics for the biostatistics workbench.

The TypeScript side used to compute means and standard deviations and then ask
an AI model to describe them in words. That produces confident prose about
numbers nobody actually tested. This runs the tests instead.

Reads one JSON object on stdin, writes one JSON object on stdout:

    {"columns": ["group", "score"], "rows": [["A", "12.5"], ["B", "14.1"]]}

Every result carries the test that produced it and the assumptions behind it,
because a student who is told "p < 0.05" without being told why is being
taught the wrong lesson. Normality and equal-variance checks are reported even
when the test passes, so a violation is visible rather than silent.

Never executes anything derived from the input. Values are parsed as floats
and only used as data.
"""

import json
import sys
import warnings

warnings.filterwarnings("ignore")

try:
    import numpy as np
    import pandas as pd
    from scipy import stats
except ImportError as exc:  # pragma: no cover - environment problem, not input
    json.dump({"ok": False, "error": f"missing python package: {exc}"}, sys.stdout)
    sys.exit(1)


MAX_ROWS = 5000


def num(value):
    """Parse a cell as a float, or None. Tolerates commas and stray spaces."""
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    if text == "" or text.lower() in {"na", "n/a", "nan", "null", "-"}:
        return None
    try:
        result = float(text)
    except ValueError:
        return None
    return result if np.isfinite(result) else None


def round_floats(obj, digits=6):
    """Round every float so JSON stays readable and diffs stay small."""
    if isinstance(obj, dict):
        return {k: round_floats(v, digits) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [round_floats(v, digits) for v in obj]
    if isinstance(obj, (np.floating, float)):
        value = float(obj)
        return None if not np.isfinite(value) else round(value, digits)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    return obj


def describe(series):
    values = series.dropna()
    n = int(values.size)
    if n == 0:
        return None
    out = {
        "n": n,
        "mean": float(values.mean()),
        "sd": float(values.std(ddof=1)) if n > 1 else 0.0,
        "min": float(values.min()),
        "max": float(values.max()),
    }
    out["median"] = float(values.median())
    out["se"] = out["sd"] / np.sqrt(n) if n > 1 else 0.0

    # Confidence interval for the mean, because an interval is what a student
    # should be quoting rather than a bare mean plus a plus-or-minus.
    if n > 1:
        tcrit = stats.t.ppf(0.975, n - 1)
        out["ci95"] = [out["mean"] - tcrit * out["se"], out["mean"] + tcrit * out["se"]]
    else:
        out["ci95"] = None

    if 2 <= n <= 5000:
        try:
            shapiro = stats.shapiro(values.to_numpy())
            out["shapiro_p"] = float(shapiro.pvalue)
            out["normal"] = bool(shapiro.pvalue > 0.05)
        except Exception:
            out["shapiro_p"] = None
            out["normal"] = None
    else:
        out["shapiro_p"] = None
        out["normal"] = None
    return out


def effect_size_t(a, b):
    """Cohen's d with the pooled SD, plus Hedges' g small-sample correction."""
    na, nb = len(a), len(b)
    if na < 2 or nb < 2:
        return None
    pooled = np.sqrt(((na - 1) * np.var(a, ddof=1) + (nb - 1) * np.var(b, ddof=1)) / (na + nb - 2))
    if pooled == 0:
        return None
    d = (np.mean(a) - np.mean(b)) / pooled
    correction = 1 - 3 / (4 * (na + nb) - 9) if (na + nb) > 3 else 1.0
    return {"cohens_d": float(d), "hedges_g": float(d * correction)}


def values_for_level(df, group_col, outcome, level):
    """Rows of `outcome` where `group_col` equals `level`, as a float array."""
    mask = df[group_col].astype(str).str.strip() == str(level)
    return df.loc[mask, outcome].dropna().to_numpy(dtype=float)


def run_ttest(df, group_col, outcome, level_a, level_b):
    a = values_for_level(df, group_col, outcome, level_a)
    b = values_for_level(df, group_col, outcome, level_b)
    if len(a) < 2 or len(b) < 2:
        return None

    levene = stats.levene(a, b)
    equal_var = bool(levene.pvalue > 0.05)

    if equal_var:
        res = stats.ttest_ind(a, b, equal_var=True)
        name = "Independent samples t-test (Student's)"
    else:
        res = stats.ttest_ind(a, b, equal_var=False)
        name = "Welch's t-test (variances unequal)"

    effect = effect_size_t(a, b)
    dfree = float(getattr(res, "df", float("nan")))
    out = {
        "test": name,
        "statistic": float(res.statistic),
        "p": float(res.pvalue),
        "df": dfree if np.isfinite(dfree) else None,
        "n_a": int(len(a)),
        "n_b": int(len(b)),
        "mean_a": float(np.mean(a)),
        "mean_b": float(np.mean(b)),
        "levene_p": float(levene.pvalue),
        "equal_variance": equal_var,
        "significant": bool(res.pvalue < 0.05),
    }
    if effect:
        out["effect"] = effect
        mag = abs(effect["cohens_d"])
        out["effect_label"] = (
            "negligible" if mag < 0.2 else "small" if mag < 0.5 else "moderate" if mag < 0.8 else "large"
        )
    return out


def run_anova(df, group_col, outcome, levels):
    samples = [values_for_level(df, group_col, outcome, lv) for lv in levels]
    samples = [s for s in samples if len(s) > 0]
    if len(samples) < 2 or any(len(s) < 2 for s in samples):
        return None
    res = stats.f_oneway(*samples)
    grand = np.concatenate(samples)
    between = sum(len(s) * (np.mean(s) - np.mean(grand)) ** 2 for s in samples)
    within = sum(((s - np.mean(s)) ** 2).sum() for s in samples)
    k = len(samples)
    n = len(grand)
    eta_sq = between / (between + within) if (between + within) > 0 else None
    out = {
        "test": f"One-way ANOVA ({k} groups)",
        "statistic": float(res.statistic),
        "p": float(res.pvalue),
        "df_between": k - 1,
        "df_within": n - k,
        "eta_squared": eta_sq,
        "significant": bool(res.pvalue < 0.05),
        "group_means": {
            str(lv): float(values_for_level(df, group_col, outcome, lv).mean())
            for lv in levels
            if values_for_level(df, group_col, outcome, lv).size > 0
        },
    }
    if k >= 3:
        try:
            h = stats.kruskal(*samples)
            out["kruskal"] = {"statistic": float(h.statistic), "p": float(h.pvalue)}
        except Exception:
            pass
    if eta_sq is not None:
        out["eta_label"] = "small" if eta_sq < 0.06 else "medium" if eta_sq < 0.14 else "large"
    return out


def run_correlation(df, cols):
    a = df[cols[0]].dropna()
    b = df[cols[1]].dropna()
    paired = pd.concat([a, b], axis=1, join="inner").dropna()
    if len(paired) < 3 or paired[cols[0]].nunique() < 2 or paired[cols[1]].nunique() < 2:
        return None
    pearson = stats.pearsonr(paired[cols[0]], paired[cols[1]])
    spearman = stats.spearmanr(paired[cols[0]], paired[cols[1]])
    return {
        "test": "Pearson & Spearman correlation",
        "pearson_r": float(pearson[0]),
        "pearson_p": float(pearson[1]),
        "spearman_rho": float(spearman[0]),
        "spearman_p": float(spearman[1]),
        "n": int(len(paired)),
        "significant": bool(pearson[1] < 0.05),
        "note": "Agreement between Pearson and Spearman suggests a linear, non-monotonic relationship is not driving the result."
        if abs(pearson[0] - spearman[0]) > 0.2
        else "Pearson and Spearman agree, which supports a linear relationship.",
    }


def run_regression(df, x, y):
    frame = df[[x, y]].dropna()
    if len(frame) < 4 or frame[x].nunique() < 2:
        return None
    slope, intercept, r_value, p_value, std_err = stats.linregress(frame[x], frame[y])
    residuals = frame[y] - (slope * frame[x] + intercept)
    try:
        _, w, _, _ = stats.f_regression(frame[x], frame[y])
        durbin = float(stats.durbin_watson(residuals.to_numpy()))
    except Exception:
        durbin = None
    r2 = r_value ** 2
    out = {
        "test": "Simple linear regression",
        "slope": float(slope),
        "intercept": float(intercept),
        "r_squared": float(r2),
        "p": float(p_value),
        "n": int(len(frame)),
        "adjusted_r_squared": float(1 - (1 - r2) * (len(frame) - 1) / (len(frame) - 2)) if len(frame) > 2 else None,
        "significant": bool(p_value < 0.05),
        "equation": f"{y} = {slope:.4g}·{x} + {intercept:.4g}",
        "residual_sd": float(np.std(residuals, ddof=2)) if len(residuals) > 2 else None,
    }
    if durbin is not None:
        out["durbin_watson"] = durbin
        if durbin < 1.5 or durbin > 2.5:
            out["autocorrelation_warning"] = (
                f"Durbin-Watson is {durbin:.2f}. Values far from 2 suggest the residuals are not independent, "
                "which invalidates the standard error and the p-value."
            )
    return out


def run_chi_square(df, cat, outcome):
    """Chi-square on a binary outcome, or an independence test if categorical."""
    frame = df[[cat, outcome]].dropna()
    if len(frame) < 4:
        return None
    table = pd.crosstab(frame[cat], frame[outcome])
    if table.shape[0] < 2 or table.shape[1] < 2:
        return None
    chi2, p, dof, expected = stats.chi2_contingency(table)
    n = table.to_numpy().sum()
    # Cramer's V, which is the effect size that suits any table size.
    phi2 = chi2 / n
    r, k = table.shape
    denom = min(k - 1, r - 1)
    cramers_v = np.sqrt(phi2 / denom) if denom > 0 else None
    out = {
        "test": "Chi-square test of independence",
        "statistic": float(chi2),
        "p": float(p),
        "dof": int(dof),
        "table": [[int(c) for c in row] for row in table.to_numpy()],
        "significant": bool(p < 0.05),
        "expected_min": float(expected.min()),
    }
    if cramers_v is not None:
        out["cramers_v"] = float(cramers_v)
    # A cell under 5 invalidates the asymptotic p-value.
    if expected.min() < 5:
        out["assumption_warning"] = (
            f"Smallest expected count is {expected.min():.1f} (below 5). The p-value may be unreliable; "
            "use Fisher's exact test or combine categories."
        )
    return out


def run_epidemiology(df, positive_col, total_col, tp, fn, tn, fp):
    """
    Diagnostic accuracy from a 2x2 table, or prevalence from two columns.

    The 2x2 is laid out disease-present / disease-absent against test-positive /
    test-negative, so tp+fn is everyone who truly has it and tn+fp is everyone
    who truly does not.
    """
    out = {}
    counts = [tp, fn, tn, fp]
    if all(isinstance(v, int) and v >= 0 for v in counts):
        sens = tp / (tp + fn) if (tp + fn) else None
        spec = tn / (tn + fp) if (tn + fp) else None
        ppv = tp / (tp + tn) if (tp + tn) else None
        npv = tn / (fn + tn) if (fn + tn) else None
        total = tp + fn + tn + fp
        if sens is not None and spec is not None and spec != 1:
            out["likelihood_ratio_positive"] = sens / (1 - spec)
        if sens is not None and sens != 0 and spec is not None:
            out["likelihood_ratio_negative"] = (1 - sens) / spec
        out.update({
            "test": "Diagnostic accuracy (2x2)",
            "sensitivity": sens,
            "specificity": spec,
            "ppv": ppv,
            "npv": npv,
            "accuracy": (tp + tn) / total if total else None,
            "table": {"tp": tp, "fn": fn, "tn": tn, "fp": fp},
        })
        try:
            orr, pf = stats.fisher_exact(np.array([[tp, fp], [fn, tn]]))
            out["odds_ratio"] = float(orr)
            out["fisher_p"] = float(pf)
            out["odds_ratio_ci"] = [
                float(np.exp(np.log(orr) - 1.96 * np.sqrt(1 / tp + 1 / fp + 1 / fn + 1 / tn))) if min(tp, fp, fn, tn) > 0 else None,
                float(np.exp(np.log(orr) + 1.96 * np.sqrt(1 / tp + 1 / fp + 1 / fn + 1 / tn))) if min(tp, fp, fn, tn) > 0 else None,
            ]
        except Exception:
            pass
        return out

    if positive_col in df.columns and total_col in df.columns:
        positives = df[positive_col].dropna()
        totals = df[total_col].dropna()
        frame = pd.concat([positives, totals], axis=1, join="inner").dropna()
        frame = frame[frame[total_col] > 0]
        if len(frame) < 2:
            return None
        prev = float(frame[positive_col].sum() / frame[total_col].sum())
        rate = (frame[positive_col] / frame[total_col]).replace([np.inf, -np.inf], np.nan).dropna()
        lo, hi = stats.beta.interval(0.95, frame[positive_col].sum() + 0.5, frame[total_col].sum() - frame[positive_col].sum() + 0.5)
        return {
            "test": "Prevalence",
            "prevalence": prev,
            "prevalence_pct": prev * 100,
            "ci95": [float(lo), float(hi)],
            "n": int(len(frame)),
            "mean_rate": float(rate.mean()) if len(rate) else None,
        }
    return None


def analyse(payload):
    columns = payload.get("columns") or []
    rows = payload.get("rows") or []
    if not columns or not rows:
        return {"ok": False, "error": "no columns or rows supplied"}

    df = pd.DataFrame(rows, columns=columns[: len(rows[0])])
    truncated = len(rows) > MAX_ROWS
    if truncated:
        df = df.head(MAX_ROWS)
    df = df.replace(r"^\s*|\s*$", "", regex=True)

    numeric_cols, categorical_cols = [], []
    for col in df.columns:
        coerced = df[col].map(num)
        if coerced.notna().sum() >= max(2, len(df) * 0.6):
            df[col] = coerced
            numeric_cols.append(col)
        else:
            categorical_cols.append(col)

    result = {
        "ok": True,
        "rows": int(len(df)),
        "columns": list(df.columns),
        "numericColumns": numeric_cols,
        "categoricalColumns": categorical_cols,
        "truncated": truncated,
        "descriptives": {},
        "frequencies": {},
        "tests": [],
        "warnings": [],
    }

    if truncated:
        result["warnings"].append(f"Only the first {MAX_ROWS} rows were analysed.")

    for col in numeric_cols:
        desc = describe(df[col])
        if desc:
            result["descriptives"][col] = desc
            if desc.get("normal") is False and desc["n"] >= 8:
                result["warnings"].append(
                    f"'{col}' is not normally distributed (Shapiro-Wilk p={desc['shapiro_p']:.3f}). "
                    "Prefer a non-parametric test or a transformation."
                )

    for col in categorical_cols[:6]:
        counts = df[col].value_counts().head(10)
        total = int(counts.sum())
        result["frequencies"][col] = {
            "n": total,
            "levels": {str(k): {"count": int(v), "pct": float(v / total * 100)} for k, v in counts.items()},
        }

    # Choose tests from the shape of the data rather than running everything.
    binary_cat = [c for c in categorical_cols if df[c].nunique() == 2]

    if len(numeric_cols) >= 2:
        result["tests"].append(("correlation", numeric_cols[0], numeric_cols[1]))

    group_col = categorical_cols[0] if categorical_cols else None
    outcome = numeric_cols[0] if numeric_cols else None

    if group_col and outcome and group_col in df.columns and outcome in df.columns:
        levels = df[group_col].dropna().unique().tolist()
        level_counts = df[group_col].value_counts()
        usable = [str(lv) for lv in levels if level_counts[lv] >= 2]
        if len(usable) == 2:
            result["tests"].append(("ttest", group_col, outcome, usable[0], usable[1]))
        elif len(usable) > 2:
            result["tests"].append(("anova", group_col, outcome, usable))

    if group_col and binary_cat:
        other = next((c for c in binary_cat if c != group_col), None)
        if other:
            result["tests"].append(("chi", group_col, other))

    if len(numeric_cols) >= 2:
        # First numeric column predicts the second. Left-to-right matches how a
        # student reads the table, and "age explains cholesterol" is the
        # direction a reader expects rather than the reverse.
        x, y = numeric_cols[0], numeric_cols[1]
        result["tests"].append(("regression", x, y))

    counts = payload.get("confusion") or {}
    epi = payload.get("epidemiology")
    executed = []
    for spec in result["tests"]:
        kind = spec[0]
        try:
            if kind == "ttest":
                got = run_ttest(df, spec[1], spec[2], spec[3], spec[4])
                if got:
                    got.update({"grouping": spec[1], "outcome": spec[2], "groups": [spec[3], spec[4]]})
                    executed.append(got)
            elif kind == "anova":
                got = run_anova(df, spec[1], spec[2], spec[3])
                if got:
                    got.update({"grouping": spec[1], "outcome": spec[2]})
                    executed.append(got)
            elif kind == "correlation":
                got = run_correlation(df, [spec[1], spec[2]])
                if got:
                    got.update({"x": spec[1], "y": spec[2]})
                    executed.append(got)
            elif kind == "regression":
                got = run_regression(df, spec[1], spec[2])
                if got:
                    got.update({"predictor": spec[1], "outcome": spec[2]})
                    executed.append(got)
            elif kind == "chi":
                got = run_chi_square(df, spec[1], spec[2])
                if got:
                    got.update({"row": spec[1], "column": spec[2]})
                    executed.append(got)
        except Exception as exc:
            result["warnings"].append(f"{kind} failed: {exc}")

    if isinstance(counts, dict) and counts:
        epi = run_epidemiology(df, None, None, counts.get("tp"), counts.get("fn"), counts.get("tn"), counts.get("fp"))
        if epi:
            executed.append(epi)
    elif isinstance(epi, dict) and epi.get("positive") and epi.get("total"):
        got = run_epidemiology(df, epi["positive"], epi["total"], None, None, None, None)
        if got:
            executed.append(got)

    result["tests"] = executed
    for t in executed:
        if t.get("assumption_warning"):
            result["warnings"].append(t["assumption_warning"])
        if t.get("autocorrelation_warning"):
            result["warnings"].append(t["autocorrelation_warning"])

    result["summary"] = build_summary(executed, result["warnings"])
    return result


def build_summary(tests, warnings):
    """One sentence naming what the data shows, plus the caveats."""
    if not tests:
        return (
            "Descriptive statistics only. With this table there are not enough groups or "
            "enough numeric columns for a hypothesis test to be valid."
        )
    parts = []
    for t in tests:
        if "test" in t and t["test"].startswith(("Independent", "Welch")):
            parts.append(
                f"{t.get('grouping', 'groups')} differs between {t['groups'][0]} and {t['groups'][1]} "
                f"(p={t['p']:.4f}, d={t.get('effect', {}).get('cohens_d', float('nan')):.2f})"
            )
        elif "test" in t and "ANOVA" in t["test"]:
            parts.append(f"a difference across {t.get('grouping', 'groups')} exists (p={t['p']:.4f})")
        elif "pearson_p" in t:
            parts.append(f"{t['y']} and {t['x']} are correlated (r={t['pearson_r']:.3f}, p={t['pearson_p']:.4f})")
        elif "r_squared" in t:
            parts.append(
                f"{t['predictor']} explains {t['r_squared'] * 100:.1f}% of the variation in {t['outcome']} "
                f"({t['equation']})"
            )
        elif "Chi-square" in str(t.get("test")):
            parts.append(f"{t.get('row')} and {t.get('column')} are associated (p={t['p']:.4f})")
        elif "sensitivity" in t:
            parts.append(
                f"sensitivity {t['sensitivity'] * 100:.1f}%, specificity {t['specificity'] * 100:.1f}%"
            )
    if not parts:
        return "Tests ran but produced no headline result."
    summary = "; ".join(parts) + "."
    if warnings:
        summary += f" Note {len(warnings)} assumption warning(s) before relying on this."
    return summary


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as exc:
        json.dump({"ok": False, "error": f"invalid JSON input: {exc}"}, sys.stdout)
        sys.exit(1)

    try:
        result = analyse(payload)
    except Exception as exc:  # never let the server see a stack trace from a user table
        result = {"ok": False, "error": str(exc)}

    json.dump(round_floats(result), sys.stdout)
    sys.exit(0 if result.get("ok") else 1)


if __name__ == "__main__":
    main()
