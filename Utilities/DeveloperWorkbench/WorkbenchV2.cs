using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PlotPickle.DeveloperWorkbench;

internal static class WorkbenchV2Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        var form = new MainForm();
        Issue1448WorkbenchEnhancer.Attach(form);
        Application.Run(form);
    }
}

internal static class Issue1448WorkbenchEnhancer
{
    public static void Attach(MainForm form)
    {
        var queue = Descendants<ListView>(form).SingleOrDefault();
        var reviewBox = Descendants<RichTextBox>(form).FirstOrDefault(control => !control.ReadOnly);
        if (queue is null || reviewBox is null) return;

        if (queue.Columns.Cast<ColumnHeader>().All(column => !string.Equals(column.Text, "Scanned", StringComparison.OrdinalIgnoreCase)))
        {
            queue.Columns.Add("Scanned", 72, HorizontalAlignment.Center);
        }

        var primary = ModelCombo("Primary local reviewer");
        var secondary = ModelCombo("Second-opinion local reviewer");
        var refreshModels = new ToolStripButton("Refresh models");
        var repomix = new ToolStripButton("Repomix context") { CheckOnClick = true, Checked = true };
        var scan = new ToolStripButton("Scan selected") { Enabled = false };
        var secondOpinion = new ToolStripButton("Second opinion") { Enabled = false };
        var status = new ToolStripLabel("Local reviewer models not loaded yet.") { Spring = true, TextAlign = ContentAlignment.MiddleLeft };

        refreshModels.ToolTipText = "Probe supported loopback runtimes for compatible coding/review models.";
        repomix.ToolTipText = "Add a bounded Repomix evidence pack when deterministic file seeds exist.";
        scan.ToolTipText = "Run the upgraded scan and mark this exact Issue revision or PR head with a green check when successful.";
        secondOpinion.ToolTipText = "Ask another local model to look for missing evidence/components and a candidate minimal fix.";

        var strip = new ToolStrip
        {
            Dock = DockStyle.Top,
            GripStyle = ToolStripGripStyle.Hidden,
            Padding = new Padding(6, 3, 6, 3),
            RenderMode = ToolStripRenderMode.System,
        };
        strip.Items.Add(new ToolStripLabel("Primary:"));
        strip.Items.Add(primary);
        strip.Items.Add(new ToolStripSeparator());
        strip.Items.Add(new ToolStripLabel("Second:"));
        strip.Items.Add(secondary);
        strip.Items.Add(refreshModels);
        strip.Items.Add(repomix);
        strip.Items.Add(scan);
        strip.Items.Add(secondOpinion);
        strip.Items.Add(status);
        form.Controls.Add(strip);
        strip.BringToFront();

        var scanState = WorkbenchScanStateStore.Load();
        var preferences = ReviewerPreferenceStore.Load();
        var timer = new System.Windows.Forms.Timer { Interval = 800 };
        timer.Tick += (_, _) =>
        {
            ApplyScanMarks(queue, scanState);
            scan.Enabled = queue.SelectedItems.Count == 1 && primary.SelectedItem is ReviewerTarget;
            secondOpinion.Enabled = queue.SelectedItems.Count == 1
                && secondary.SelectedItem is ReviewerTarget
                && !string.IsNullOrWhiteSpace(reviewBox.Text);
        };
        timer.Start();
        form.FormClosed += (_, _) => timer.Dispose();

        primary.SelectedIndexChanged += (_, _) =>
        {
            if (primary.SelectedItem is not ReviewerTarget target) return;
            preferences.PrimaryKey = target.Key;
            ReviewerPreferenceStore.Save(preferences);
        };
        secondary.SelectedIndexChanged += (_, _) =>
        {
            if (secondary.SelectedItem is not ReviewerTarget target) return;
            preferences.SecondaryKey = target.Key;
            ReviewerPreferenceStore.Save(preferences);
        };

        refreshModels.Click += async (_, _) => await RunUiActionAsync(form, status, "Refreshing local reviewer models...", async () =>
        {
            await RefreshInventoryAsync(primary, secondary, preferences, status);
        });

        scan.Click += async (_, _) => await RunUiActionAsync(form, status, "Scanning selected work item...", async () =>
        {
            if (queue.SelectedItems.Count != 1 || queue.SelectedItems[0].Tag is not WorkItem item) return;
            if (primary.SelectedItem is not ReviewerTarget target) return;
            var settings = SettingsStore.Load();
            ValidateRepository(settings.RepositoryPath);

            var client = new GitHubClient(settings.Repository, settings.RepositoryPath);
            await client.CheckAuthAsync();
            var reviewPackage = await client.GetReviewPackageAsync(item, QueueItems(queue));
            var augmented = await BuildAugmentedPackageAsync(reviewPackage, repomix.Checked, status);
            var readiness = await VerifyTargetReadinessAsync(settings.RepositoryPath, target);
            var result = await RunReviewBridgeAsync(
                settings.RepositoryPath,
                augmented,
                target,
                Path.Combine(settings.RepositoryPath, "scripts", "pi-work-item-review.mjs"),
                "developer-brief.md");

            var reviewer = DescribeTarget(target, readiness);
            reviewBox.Text = $"Upgraded Workbench scan · {reviewer} · {DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss zzz}\n\n{result}";
            scanState.Set(settings.Repository, item, target, reviewPackage.PullRequest?.HeadSha ?? string.Empty);
            WorkbenchScanStateStore.Save(scanState);
            ApplyScanMarks(queue, scanState);
            status.Text = $"✓ {item.Kind} #{item.Number} scanned with {reviewer}.";
        });

        secondOpinion.Click += async (_, _) => await RunUiActionAsync(form, status, "Running second-opinion review...", async () =>
        {
            if (queue.SelectedItems.Count != 1 || queue.SelectedItems[0].Tag is not WorkItem item) return;
            if (secondary.SelectedItem is not ReviewerTarget target) return;
            if (primary.SelectedItem is ReviewerTarget primaryTarget
                && string.Equals(primaryTarget.Key, target.Key, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Choose a different local model for Second opinion so the pass is genuinely independent.");
            }
            if (string.IsNullOrWhiteSpace(reviewBox.Text)) throw new InvalidOperationException("Run Scan selected first so the second reviewer has a primary brief to challenge.");

            var settings = SettingsStore.Load();
            ValidateRepository(settings.RepositoryPath);
            var client = new GitHubClient(settings.Repository, settings.RepositoryPath);
            await client.CheckAuthAsync();
            var reviewPackage = await client.GetReviewPackageAsync(item, QueueItems(queue));
            var augmented = await BuildAugmentedPackageAsync(reviewPackage, repomix.Checked, status, reviewBox.Text);
            var readiness = await VerifyTargetReadinessAsync(settings.RepositoryPath, target);
            var result = await RunReviewBridgeAsync(
                settings.RepositoryPath,
                augmented,
                target,
                Path.Combine(settings.RepositoryPath, "Utilities", "DeveloperWorkbench", "second-opinion-review.mjs"),
                "second-opinion.md");
            ShowSecondOpinion(form, reviewBox, result, DescribeTarget(target, readiness), reviewPackage.PullRequest?.HeadSha ?? string.Empty);
            status.Text = $"Second opinion ready from {DescribeTarget(target, readiness)}. Incorporation remains Human-controlled.";
        });

        form.Shown += async (_, _) => await RunUiActionAsync(form, status, "Discovering local reviewer models...", async () =>
        {
            await RefreshInventoryAsync(primary, secondary, preferences, status);
            ApplyScanMarks(queue, scanState);
        }, false);
    }

    private static ToolStripComboBox ModelCombo(string tooltip) => new()
    {
        Width = 275,
        AutoSize = false,
        DropDownStyle = ComboBoxStyle.DropDownList,
        ToolTipText = tooltip,
    };

    private static async Task RefreshInventoryAsync(
        ToolStripComboBox primary,
        ToolStripComboBox secondary,
        ReviewerPreferences preferences,
        ToolStripLabel status)
    {
        var settings = SettingsStore.Load();
        ValidateRepository(settings.RepositoryPath);
        var script = Path.Combine(settings.RepositoryPath, "Utilities", "DeveloperWorkbench", "local-reviewer-inventory.mjs");
        var raw = await WorkbenchProcess.RunAsync("node", [script, "--json"], settings.RepositoryPath, TimeSpan.FromSeconds(40));
        var report = JsonSerializer.Deserialize<ReviewerInventoryReport>(raw, JsonOptions.Standard)
            ?? throw new InvalidOperationException("Local reviewer inventory returned invalid JSON.");

        var targets = new List<ReviewerTarget> { ReviewerTarget.Automatic(report.Automatic) };
        targets.AddRange(report.Candidates.Where(candidate => candidate.Selectable && candidate.Ready).Select(ReviewerTarget.FromCandidate));
        PopulateCombo(primary, targets, preferences.PrimaryKey);
        PopulateCombo(secondary, targets, preferences.SecondaryKey);
        status.Text = targets.Count == 1
            ? "Automatic Pi / Repair reviewer is available; no additional approved loopback reviewer is currently advertised."
            : $"{targets.Count - 1} selectable local reviewer target(s) found. llama.cpp appears separately from Ollama.";
    }

    private static void PopulateCombo(ToolStripComboBox combo, IReadOnlyList<ReviewerTarget> targets, string preference)
    {
        combo.Items.Clear();
        foreach (var target in targets) combo.Items.Add(target);
        var preferred = targets.ToList().FindIndex(target => string.Equals(target.Key, preference, StringComparison.OrdinalIgnoreCase));
        combo.SelectedIndex = preferred >= 0 ? preferred : 0;
    }

    private static async Task<string> BuildAugmentedPackageAsync(
        ReviewPackage reviewPackage,
        bool repomix,
        ToolStripLabel status,
        string primaryReview = "")
    {
        var root = JsonNode.Parse(JsonSerializer.Serialize(reviewPackage, JsonOptions.Indented))?.AsObject()
            ?? throw new InvalidOperationException("Could not serialize the current Workbench review package.");
        var scan = new JsonObject
        {
            ["schemaVersion"] = 1,
            ["generatedAt"] = DateTimeOffset.UtcNow.ToString("O"),
        };
        if (!string.IsNullOrWhiteSpace(primaryReview)) scan["primaryReview"] = primaryReview;
        if (repomix)
        {
            try
            {
                scan["repomixEvidence"] = Limit(await BuildRepomixEvidenceAsync(reviewPackage), 90_000);
                status.Text = "Bounded Repomix evidence ready; starting local reviewer...";
            }
            catch (Exception error)
            {
                scan["repomixEvidence"] = $"[Repomix evidence unavailable: {OneLine(error.Message)}]";
                status.Text = "Repomix evidence unavailable; continuing with bounded GitHub evidence and read-only repository inspection.";
            }
        }
        root["upgradedWorkbenchScan"] = scan;
        return root.ToJsonString(JsonOptions.Indented);
    }

    private static async Task<string> BuildRepomixEvidenceAsync(ReviewPackage reviewPackage)
    {
        var script = Path.Combine(reviewPackage.RepositoryPath, "Utilities", "DeveloperWorkbench", "workbench-repomix-evidence.mjs");
        if (!File.Exists(script)) throw new FileNotFoundException("Workbench Repomix evidence builder is missing.", script);
        var tempRoot = Path.Combine(Path.GetTempPath(), "PlotPickle", "DeveloperWorkbench", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempRoot);
        var input = Path.Combine(tempRoot, "review-package.json");
        var output = Path.Combine(tempRoot, "repomix-evidence.md");
        try
        {
            await File.WriteAllTextAsync(input, JsonSerializer.Serialize(reviewPackage, JsonOptions.Indented), new UTF8Encoding(false));
            await WorkbenchProcess.RunAsync("node", [script, "--input", input, "--output", output], reviewPackage.RepositoryPath, TimeSpan.FromMinutes(4));
            if (!File.Exists(output)) throw new InvalidOperationException("Repomix evidence builder did not produce its expected output.");
            return await File.ReadAllTextAsync(output);
        }
        finally
        {
            try { Directory.Delete(tempRoot, true); } catch { }
        }
    }

    private static async Task<PiReadinessReport> VerifyTargetReadinessAsync(string repositoryPath, ReviewerTarget target)
    {
        var script = Path.Combine(repositoryPath, "scripts", "pi-work-item-review.mjs");
        var raw = await WorkbenchProcess.RunAsync(
            "node",
            [script, "--readiness", "--repository-path", repositoryPath],
            repositoryPath,
            TimeSpan.FromMinutes(16),
            target.Environment());
        var report = JsonSerializer.Deserialize<PiReadinessReport>(raw, JsonOptions.Standard)
            ?? throw new InvalidOperationException("Selected reviewer readiness returned invalid JSON.");
        if (!report.Ready || !report.Pi.Ready || !report.Runtime.Ready || !report.Inference.Ready)
        {
            throw new InvalidOperationException($"Selected reviewer is not ready. {report.Runtime.Detail} {report.Inference.Detail}".Trim());
        }
        if (!target.IsAutomatic
            && (!string.Equals(report.Runtime.Model, target.Model, StringComparison.OrdinalIgnoreCase)
                || !SameEndpoint(report.Runtime.BaseUrl, target.BaseUrl)))
        {
            throw new InvalidOperationException($"Selected reviewer resolved a different runtime/model. Requested {target}; resolved {report.Runtime.Label} · {report.Runtime.Model}.");
        }
        return report;
    }

    private static async Task<string> RunReviewBridgeAsync(
        string repositoryPath,
        string inputJson,
        ReviewerTarget target,
        string script,
        string outputName)
    {
        if (!File.Exists(script)) throw new FileNotFoundException("Developer Workbench review bridge is missing.", script);
        var tempRoot = Path.Combine(Path.GetTempPath(), "PlotPickle", "DeveloperWorkbench", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempRoot);
        var input = Path.Combine(tempRoot, "review-package.json");
        var output = Path.Combine(tempRoot, outputName);
        try
        {
            await File.WriteAllTextAsync(input, inputJson, new UTF8Encoding(false));
            await WorkbenchProcess.RunAsync(
                "node",
                [script, "--input", input, "--output", output],
                repositoryPath,
                TimeSpan.FromMinutes(18),
                target.Environment());
            if (!File.Exists(output)) throw new InvalidOperationException("Local reviewer finished without writing the expected result.");
            var result = await File.ReadAllTextAsync(output);
            if (string.IsNullOrWhiteSpace(result)) throw new InvalidOperationException("Local reviewer returned an empty result.");
            return result.Trim();
        }
        finally
        {
            try { Directory.Delete(tempRoot, true); } catch { }
        }
    }

    private static void ShowSecondOpinion(Form owner, RichTextBox primary, string result, string reviewer, string headSha)
    {
        using var dialog = new Form
        {
            Text = $"PlotPickle Second Opinion · {reviewer}",
            Width = 1050,
            Height = 760,
            StartPosition = FormStartPosition.CenterParent,
            MinimizeBox = false,
            MaximizeBox = true,
        };
        var text = new RichTextBox
        {
            Dock = DockStyle.Fill,
            ReadOnly = true,
            Font = new Font("Consolas", 9.5F),
            Text = $"Reviewer: {reviewer}\nExact reviewed PR head: {(string.IsNullOrWhiteSpace(headSha) ? "n/a (Issue-only)" : headSha)}\n\n{result}",
        };
        var actions = new FlowLayoutPanel { Dock = DockStyle.Bottom, AutoSize = true, Padding = new Padding(8), FlowDirection = FlowDirection.RightToLeft };
        var close = new Button { Text = "Close", AutoSize = true };
        var append = new Button { Text = "Append to editable brief", AutoSize = true };
        var copy = new Button { Text = "Copy", AutoSize = true };
        close.Click += (_, _) => dialog.Close();
        copy.Click += (_, _) => Clipboard.SetText(text.Text);
        append.Click += (_, _) =>
        {
            primary.AppendText($"\n\n---\n\n## HUMAN-INCLUDED SECOND OPINION\nReviewer: {reviewer}\n\n{result.Trim()}\n");
            dialog.Close();
        };
        actions.Controls.Add(close);
        actions.Controls.Add(append);
        actions.Controls.Add(copy);
        dialog.Controls.Add(text);
        dialog.Controls.Add(actions);
        dialog.ShowDialog(owner);
    }

    private static void ApplyScanMarks(ListView queue, WorkbenchScanState state)
    {
        foreach (ListViewItem row in queue.Items)
        {
            while (row.SubItems.Count < 5) row.SubItems.Add(string.Empty);
            row.UseItemStyleForSubItems = false;
            if (row.Tag is WorkItem item && state.IsCurrent(SettingsStore.Load().Repository, item))
            {
                row.SubItems[4].Text = "✓";
                row.SubItems[4].ForeColor = Color.ForestGreen;
                row.SubItems[4].Font = new Font(queue.Font, FontStyle.Bold);
            }
            else
            {
                row.SubItems[4].Text = string.Empty;
                row.SubItems[4].ForeColor = queue.ForeColor;
                row.SubItems[4].Font = queue.Font;
            }
        }
    }

    private static List<WorkItem> QueueItems(ListView queue)
        => queue.Items.Cast<ListViewItem>().Select(row => row.Tag).OfType<WorkItem>().ToList();

    private static string DescribeTarget(ReviewerTarget target, PiReadinessReport report)
        => target.IsAutomatic
            ? $"Automatic · {report.Runtime.Label} · {report.Runtime.Model}"
            : $"{target.RuntimeLabel} · {target.Model}";

    private static bool SameEndpoint(string left, string right)
        => string.Equals(NormalizeEndpoint(left), NormalizeEndpoint(right), StringComparison.OrdinalIgnoreCase);

    private static string NormalizeEndpoint(string value) => String(value).Trim().TrimEnd('/');
    private static string Limit(string text, int max) => text.Length <= max ? text : text[..max] + "\n[bounded by Developer Workbench]";
    private static string OneLine(string text) => text.Replace('\r', ' ').Replace('\n', ' ').Trim();

    private static void ValidateRepository(string path)
    {
        if (!Directory.Exists(path)
            || !File.Exists(Path.Combine(path, "AGENTS.md"))
            || !File.Exists(Path.Combine(path, "scripts", "pi-work-item-review.mjs")))
        {
            throw new InvalidOperationException("Choose a current PlotPickle local repository before using upgraded scans.");
        }
    }

    private static IEnumerable<T> Descendants<T>(Control root) where T : Control
    {
        foreach (Control child in root.Controls)
        {
            if (child is T typed) yield return typed;
            foreach (var nested in Descendants<T>(child)) yield return nested;
        }
    }

    private static async Task RunUiActionAsync(Form form, ToolStripLabel status, string message, Func<Task> action, bool showDialogOnError = true)
    {
        try
        {
            form.UseWaitCursor = true;
            status.Text = message;
            await action();
        }
        catch (Exception error)
        {
            status.Text = "Stopped: " + OneLine(error.Message);
            if (showDialogOnError) MessageBox.Show(form, error.Message, form.Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            form.UseWaitCursor = false;
        }
    }
}

internal static class WorkbenchProcess
{
    public static async Task<string> RunAsync(
        string command,
        IEnumerable<string> arguments,
        string workingDirectory,
        TimeSpan timeout,
        IReadOnlyDictionary<string, string>? environment = null)
    {
        var start = new ProcessStartInfo
        {
            FileName = command,
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
        foreach (var argument in arguments) start.ArgumentList.Add(argument);
        if (environment is not null)
        {
            foreach (var item in environment) start.Environment[item.Key] = item.Value;
        }
        using var process = new Process { StartInfo = start };
        if (!process.Start()) throw new InvalidOperationException($"Could not start {command}.");
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        using var timeoutCts = new CancellationTokenSource(timeout);
        try
        {
            await process.WaitForExitAsync(timeoutCts.Token);
        }
        catch (OperationCanceledException)
        {
            try { process.Kill(true); } catch { }
            throw new TimeoutException($"{command} exceeded the {timeout.TotalMinutes:0.#}-minute Workbench timeout.");
        }
        var output = await stdout;
        var error = await stderr;
        if (process.ExitCode != 0)
        {
            var detail = string.IsNullOrWhiteSpace(error) ? output : error;
            throw new InvalidOperationException($"{command} exited with code {process.ExitCode}.\n{detail.Trim()[..Math.Min(detail.Trim().Length, 8000)]}");
        }
        return output.Trim();
    }
}

internal sealed class ReviewerTarget
{
    public string Key { get; init; } = "automatic";
    public string Runtime { get; init; } = "automatic";
    public string RuntimeLabel { get; init; } = "Automatic";
    public string BaseUrl { get; init; } = string.Empty;
    public string Model { get; init; } = string.Empty;
    public bool IsAutomatic => string.Equals(Key, "automatic", StringComparison.OrdinalIgnoreCase);

    public static ReviewerTarget Automatic(ReviewerInventoryCandidate? automatic) => new()
    {
        Key = "automatic",
        Runtime = "automatic",
        RuntimeLabel = "Automatic · Pi / Repair recommended",
        BaseUrl = automatic?.BaseUrl ?? string.Empty,
        Model = automatic?.Model ?? string.Empty,
    };

    public static ReviewerTarget FromCandidate(ReviewerInventoryCandidate candidate) => new()
    {
        Key = candidate.Key,
        Runtime = candidate.Runtime,
        RuntimeLabel = candidate.Label,
        BaseUrl = candidate.BaseUrl,
        Model = candidate.Model,
    };

    public Dictionary<string, string> Environment()
    {
        if (IsAutomatic) return [];
        return new Dictionary<string, string>
        {
            ["PLOTPICKLE_REPAIR_ENDPOINT"] = BaseUrl,
            ["PLOTPICKLE_REPAIR_MODEL"] = Model,
        };
    }

    public override string ToString() => IsAutomatic
        ? "Automatic · Pi / Repair recommended"
        : $"{RuntimeLabel} · {Model}";
}

internal sealed class ReviewerInventoryReport
{
    public int SchemaVersion { get; set; }
    public ReviewerInventoryCandidate? Automatic { get; set; }
    public List<ReviewerInventoryCandidate> Candidates { get; set; } = [];
}

internal sealed class ReviewerInventoryCandidate
{
    public string Key { get; set; } = string.Empty;
    public string Runtime { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public bool Selectable { get; set; }
    public bool Ready { get; set; }
}

internal sealed class ReviewerPreferences
{
    public string PrimaryKey { get; set; } = "automatic";
    public string SecondaryKey { get; set; } = "automatic";
}

internal static class ReviewerPreferenceStore
{
    private static readonly string DirectoryPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PlotPickle", "DeveloperWorkbench");
    private static readonly string FilePath = Path.Combine(DirectoryPath, "reviewer-preferences-v1.json");

    public static ReviewerPreferences Load()
    {
        try
        {
            if (File.Exists(FilePath)) return JsonSerializer.Deserialize<ReviewerPreferences>(File.ReadAllText(FilePath), JsonOptions.Standard) ?? new ReviewerPreferences();
        }
        catch { }
        return new ReviewerPreferences();
    }

    public static void Save(ReviewerPreferences value)
    {
        Directory.CreateDirectory(DirectoryPath);
        File.WriteAllText(FilePath, JsonSerializer.Serialize(value, JsonOptions.Indented), new UTF8Encoding(false));
    }
}

internal sealed class WorkbenchScanState
{
    public int SchemaVersion { get; set; } = 1;
    public Dictionary<string, WorkbenchScanRecord> Records { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public void Set(string repository, WorkItem item, ReviewerTarget target, string reviewedHeadSha)
    {
        Records[Key(repository, item)] = new WorkbenchScanRecord
        {
            Fingerprint = Fingerprint(item),
            ReviewedHeadSha = reviewedHeadSha,
            ReviewerKey = target.Key,
            ScannedAt = DateTimeOffset.UtcNow,
        };
    }

    public bool IsCurrent(string repository, WorkItem item)
        => Records.TryGetValue(Key(repository, item), out var record)
            && string.Equals(record.Fingerprint, Fingerprint(item), StringComparison.Ordinal);

    private static string Key(string repository, WorkItem item) => $"{repository}|{item.Kind}|{item.Number}".ToLowerInvariant();
    private static string Fingerprint(WorkItem item) => string.Equals(item.Kind, "PR", StringComparison.OrdinalIgnoreCase)
        ? $"pr:{item.HeadSha.ToLowerInvariant()}"
        : $"issue:{item.UpdatedAt.ToUniversalTime():O}";
}

internal sealed class WorkbenchScanRecord
{
    public string Fingerprint { get; set; } = string.Empty;
    public string ReviewedHeadSha { get; set; } = string.Empty;
    public string ReviewerKey { get; set; } = string.Empty;
    public DateTimeOffset ScannedAt { get; set; }
}

internal static class WorkbenchScanStateStore
{
    private static readonly string DirectoryPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PlotPickle", "DeveloperWorkbench");
    private static readonly string FilePath = Path.Combine(DirectoryPath, "scan-state-v1.json");

    public static WorkbenchScanState Load()
    {
        try
        {
            if (File.Exists(FilePath)) return JsonSerializer.Deserialize<WorkbenchScanState>(File.ReadAllText(FilePath), JsonOptions.Standard) ?? new WorkbenchScanState();
        }
        catch { }
        return new WorkbenchScanState();
    }

    public static void Save(WorkbenchScanState value)
    {
        Directory.CreateDirectory(DirectoryPath);
        File.WriteAllText(FilePath, JsonSerializer.Serialize(value, JsonOptions.Indented), new UTF8Encoding(false));
    }
}
