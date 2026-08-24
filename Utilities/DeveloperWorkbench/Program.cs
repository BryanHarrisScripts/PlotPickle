using System.Diagnostics;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace PlotPickle.DeveloperWorkbench;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}

internal sealed class MainForm : Form
{
    private readonly TextBox _repository = new() { Width = 220 };
    private readonly TextBox _repositoryPath = new() { Width = 420 };
    private readonly Button _browse = new() { Text = "Browse...", AutoSize = true };
    private readonly Button _load = new() { Text = "Load GitHub work", AutoSize = true };
    private readonly Button _refreshReadiness = new() { Text = "Refresh readiness", AutoSize = true };
    private readonly ComboBox _filter = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 130 };
    private readonly TextBox _search = new() { PlaceholderText = "Search # / title", Dock = DockStyle.Fill };
    private readonly ListView _queue = new() { View = View.Details, FullRowSelect = true, HideSelection = false, Dock = DockStyle.Fill };
    private readonly RichTextBox _evidence = new() { ReadOnly = true, Dock = DockStyle.Fill, Font = new Font("Consolas", 9F) };
    private readonly RichTextBox _review = new() { Dock = DockStyle.Fill, Font = new Font("Consolas", 9F), AcceptsTab = true };
    private readonly Button _reviewWithPi = new() { Text = "Review with Pi", AutoSize = true, Enabled = false };
    private readonly Button _copy = new() { Text = "Copy brief", AutoSize = true, Enabled = false };
    private readonly Button _publish = new() { Text = "Publish approved brief", AutoSize = true, Enabled = false };
    private readonly Label _status = new() { Text = "Ready", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft };
    private readonly ToolTip _readinessDetails = new();
    private readonly Label _buildState = CreateReadinessLabel("BUILD");
    private readonly Label _githubState = CreateReadinessLabel("GITHUB");
    private readonly Label _repoState = CreateReadinessLabel("LOCAL REPO");
    private readonly Label _nodeState = CreateReadinessLabel("NODE");
    private readonly Label _piState = CreateReadinessLabel("PI");
    private readonly Label _runtimeState = CreateReadinessLabel("LOCAL LLM");
    private readonly Label _inferenceState = CreateReadinessLabel("INFERENCE");

    private GitHubClient? _github;
    private List<WorkItem> _items = [];
    private WorkItem? _selected;
    private ReviewPackage? _currentPackage;
    private string _reviewedHeadSha = string.Empty;
    private bool _reviewStackReady;
    private bool _evidenceReady;

    public MainForm()
    {
        Text = $"PlotPickle Developer Workbench · {WorkbenchBuildIdentity.Current}";
        MinimumSize = new Size(1180, 760);
        Width = 1500;
        Height = 940;
        StartPosition = FormStartPosition.CenterScreen;

        _queue.Columns.Add("Type", 58);
        _queue.Columns.Add("#", 58);
        _queue.Columns.Add("Title", 330);
        _queue.Columns.Add("Updated", 120);
        _queue.Columns.Add("State", 90);

        _filter.Items.AddRange(["All", "Red / blocked", "Issues", "PRs", "Recent"]);
        _filter.SelectedIndex = 0;

        var settings = SettingsStore.Load();
        _repository.Text = settings.Repository;
        _repositoryPath.Text = settings.RepositoryPath;

        BuildLayout();
        WireEvents();
        SetReadiness(_buildState, "BUILD", ReadinessLevel.Ready, WorkbenchBuildIdentity.Current, "This identity is embedded in the executable at publish time.");
        Shown += async (_, _) => await RefreshReadinessAsync();
    }

    private void BuildLayout()
    {
        var topArea = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 126,
            RowCount = 2,
            ColumnCount = 1,
            Padding = new Padding(0),
        };
        topArea.RowStyles.Add(new RowStyle(SizeType.Absolute, 66));
        topArea.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        var top = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(10),
            WrapContents = false,
            AutoScroll = true,
        };
        top.Controls.Add(new Label { Text = "Repository", AutoSize = true, Margin = new Padding(0, 7, 6, 0) });
        top.Controls.Add(_repository);
        top.Controls.Add(new Label { Text = "Local repo", AutoSize = true, Margin = new Padding(14, 7, 6, 0) });
        top.Controls.Add(_repositoryPath);
        top.Controls.Add(_browse);
        top.Controls.Add(_load);

        var readiness = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(10, 0, 10, 8),
            WrapContents = true,
            AutoScroll = true,
        };
        readiness.Controls.Add(_buildState);
        readiness.Controls.Add(_githubState);
        readiness.Controls.Add(_repoState);
        readiness.Controls.Add(_nodeState);
        readiness.Controls.Add(_piState);
        readiness.Controls.Add(_runtimeState);
        readiness.Controls.Add(_inferenceState);
        readiness.Controls.Add(_refreshReadiness);

        topArea.Controls.Add(top, 0, 0);
        topArea.Controls.Add(readiness, 0, 1);

        var body = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 3,
            RowCount = 1,
            Padding = new Padding(8, 0, 8, 8),
        };
        body.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 27));
        body.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 36));
        body.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 37));
        body.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        var left = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, ColumnCount = 1, Margin = new Padding(2) };
        left.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        left.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        left.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        left.Controls.Add(new Label { Text = "GitHub work queue", AutoSize = true, Font = new Font(Font, FontStyle.Bold), Padding = new Padding(0, 0, 0, 6) }, 0, 0);
        var filters = new TableLayoutPanel { Dock = DockStyle.Top, ColumnCount = 2, Height = 34 };
        filters.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        filters.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        filters.Controls.Add(_filter, 0, 0);
        filters.Controls.Add(_search, 1, 0);
        left.Controls.Add(filters, 0, 1);
        left.Controls.Add(_queue, 0, 2);

        var center = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 2, ColumnCount = 1, Margin = new Padding(8, 2, 8, 2) };
        center.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        center.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        center.Controls.Add(new Label { Text = "Selected Issue / PR evidence", AutoSize = true, Font = new Font(Font, FontStyle.Bold), Padding = new Padding(0, 0, 0, 6) }, 0, 0);
        center.Controls.Add(_evidence, 0, 1);

        var right = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, ColumnCount = 1, Margin = new Padding(2) };
        right.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        right.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        right.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        right.Controls.Add(new Label { Text = "Pi developer brief", AutoSize = true, Font = new Font(Font, FontStyle.Bold), Padding = new Padding(0, 0, 0, 6) }, 0, 0);
        var actions = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true, Padding = new Padding(0, 0, 0, 6) };
        actions.Controls.Add(_reviewWithPi);
        actions.Controls.Add(_copy);
        actions.Controls.Add(_publish);
        right.Controls.Add(actions, 0, 1);
        right.Controls.Add(_review, 0, 2);

        body.Controls.Add(left, 0, 0);
        body.Controls.Add(center, 1, 0);
        body.Controls.Add(right, 2, 0);

        var bottom = new Panel { Dock = DockStyle.Bottom, Height = 30, Padding = new Padding(10, 2, 10, 2) };
        bottom.Controls.Add(_status);

        Controls.Add(body);
        Controls.Add(bottom);
        Controls.Add(topArea);
    }

    private void WireEvents()
    {
        _browse.Click += (_, _) => BrowseRepository();
        _load.Click += async (_, _) => await LoadQueueAsync();
        _refreshReadiness.Click += async (_, _) => await RefreshReadinessAsync();
        _repositoryPath.TextChanged += (_, _) => InvalidateReadinessForRepositoryChange();
        _filter.SelectedIndexChanged += (_, _) => RenderQueue();
        _search.TextChanged += (_, _) => RenderQueue();
        _queue.SelectedIndexChanged += async (_, _) => await QueueSelectionChangedAsync();
        _reviewWithPi.Click += async (_, _) => await ReviewWithPiAsync();
        _copy.Click += (_, _) => CopyBrief();
        _publish.Click += async (_, _) => await PublishAsync();
    }

    private void BrowseRepository()
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = "Choose the local PlotPickle repository used by Pi for read-only inspection.",
            ShowNewFolderButton = false,
            SelectedPath = Directory.Exists(_repositoryPath.Text) ? _repositoryPath.Text : string.Empty,
        };
        if (dialog.ShowDialog(this) == DialogResult.OK) _repositoryPath.Text = dialog.SelectedPath;
    }

    private async Task LoadQueueAsync()
    {
        var repository = _repository.Text.Trim();
        var repositoryPath = _repositoryPath.Text.Trim();
        if (!Regex.IsMatch(repository, @"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$"))
        {
            MessageBox.Show(this, "Repository must be in owner/name form.", Text, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        if (!Directory.Exists(repositoryPath))
        {
            SetReadiness(_repoState, "LOCAL REPO", ReadinessLevel.Failed, "RED", "Choose an existing local PlotPickle repository folder.");
            MessageBox.Show(this, "Choose the local PlotPickle repository folder first.", Text, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        await RunUiTaskAsync("Loading GitHub work queue...", async () =>
        {
            SettingsStore.Save(new WorkbenchSettings(repository, repositoryPath));
            _github = new GitHubClient(repository, repositoryPath);
            try
            {
                await _github.CheckAuthAsync();
                SetReadiness(_githubState, "GITHUB", ReadinessLevel.Ready, "CONNECTED", "GitHub CLI authentication is valid for github.com.");
            }
            catch (Exception error)
            {
                SetReadiness(_githubState, "GITHUB", ReadinessLevel.Failed, "RED", error.Message);
                throw;
            }
            _items = await _github.ListOpenItemsAsync();
            _selected = null;
            _currentPackage = null;
            _reviewedHeadSha = string.Empty;
            _evidenceReady = false;
            _evidence.Clear();
            _review.Clear();
            UpdateReviewAvailability();
            _copy.Enabled = false;
            _publish.Enabled = false;
            RenderQueue();
            SetStatus($"Loaded {_items.Count} open work items. GitHub queue is ready; Pi review still follows the readiness lights above.");
        });
    }

    private void RenderQueue()
    {
        if (_queue.IsDisposed) return;
        var mode = _filter.SelectedItem?.ToString() ?? "All";
        var search = _search.Text.Trim();
        IEnumerable<WorkItem> visible = _items;
        visible = mode switch
        {
            "Red / blocked" => visible.Where(item => item.Kind == "PR" && (item.Status is "RED" or "BLOCKED")),
            "Issues" => visible.Where(item => item.Kind == "Issue"),
            "PRs" => visible.Where(item => item.Kind == "PR"),
            "Recent" => visible.OrderByDescending(item => item.UpdatedAt).Take(30),
            _ => visible,
        };
        if (!string.IsNullOrWhiteSpace(search))
        {
            visible = visible.Where(item => item.Number.ToString().Contains(search, StringComparison.OrdinalIgnoreCase)
                || item.Title.Contains(search, StringComparison.OrdinalIgnoreCase));
        }

        _queue.BeginUpdate();
        _queue.Items.Clear();
        foreach (var item in visible.OrderByDescending(item => item.UpdatedAt))
        {
            var row = new ListViewItem(item.Kind);
            row.SubItems.Add(item.Number.ToString());
            row.SubItems.Add(item.Title);
            row.SubItems.Add(item.UpdatedAt.ToLocalTime().ToString("yyyy-MM-dd HH:mm"));
            row.SubItems.Add(item.Status);
            row.Tag = item;
            _queue.Items.Add(row);
        }
        _queue.EndUpdate();
    }

    private async Task QueueSelectionChangedAsync()
    {
        if (_queue.SelectedItems.Count != 1 || _github is null) return;
        if (_queue.SelectedItems[0].Tag is not WorkItem item) return;
        _selected = item;
        await RunUiTaskAsync($"Collecting #{item.Number} evidence...", async () =>
        {
            _currentPackage = await _github.GetReviewPackageAsync(item, _items);
            _evidence.Text = EvidenceRenderer.Render(_currentPackage);
            _review.Clear();
            _reviewedHeadSha = string.Empty;
            _evidenceReady = true;
            UpdateReviewAvailability();
            _copy.Enabled = false;
            _publish.Enabled = false;
            SetStatus(_reviewStackReady
                ? $"Evidence ready for {item.Kind} #{item.Number}. Pi review stack is green."
                : $"Evidence ready for {item.Kind} #{item.Number}. Review with Pi remains disabled until PI, LOCAL LLM and INFERENCE are green.");
        });
    }

    private async Task ReviewWithPiAsync()
    {
        if (_currentPackage is null) return;
        if (!_reviewStackReady)
        {
            UpdateReviewAvailability();
            SetStatus("Review with Pi is blocked until PI, LOCAL LLM and INFERENCE are green. Choose Refresh readiness after starting the local model runtime.");
            return;
        }
        await RunUiTaskAsync("Pi is reviewing the exact work-item package...", async () =>
        {
            var runner = new PiReviewRunner(_currentPackage.RepositoryPath);
            try
            {
                var markdown = await runner.RunAsync(_currentPackage);
                _review.Text = markdown;
            }
            catch
            {
                _reviewStackReady = false;
                SetReadiness(_inferenceState, "INFERENCE", ReadinessLevel.Failed, "RED", "The review call failed after the last readiness check. Refresh readiness before another Pi review.");
                UpdateReviewAvailability();
                throw;
            }
            _reviewedHeadSha = _currentPackage.PullRequest?.HeadSha ?? string.Empty;
            _copy.Enabled = true;
            _publish.Enabled = true;
            SetStatus(string.IsNullOrWhiteSpace(_reviewedHeadSha)
                ? "Pi brief ready for Human review."
                : $"Pi brief ready. Reviewed head {_reviewedHeadSha[..Math.Min(12, _reviewedHeadSha.Length)]}.");
        });
    }

    private void CopyBrief()
    {
        if (string.IsNullOrWhiteSpace(_review.Text)) return;
        Clipboard.SetText(_review.Text);
        SetStatus("Developer brief copied.");
    }

    private async Task PublishAsync()
    {
        if (_github is null || _currentPackage is null || string.IsNullOrWhiteSpace(_review.Text)) return;
        var targetText = _currentPackage.Issue is not null && _currentPackage.PullRequest is not null
            ? $"Issue #{_currentPackage.Issue.Number} and PR #{_currentPackage.PullRequest.Number}"
            : _currentPackage.Issue is not null
                ? $"Issue #{_currentPackage.Issue.Number}"
                : $"PR #{_currentPackage.PullRequest?.Number}";
        var answer = MessageBox.Show(this,
            $"Publish the approved brief to {targetText}?\n\nFor a linked package, the Issue receives/updates the Current developer brief section and the PR receives a guidance comment.",
            "Publish approved brief",
            MessageBoxButtons.OKCancel,
            MessageBoxIcon.Question);
        if (answer != DialogResult.OK) return;

        await RunUiTaskAsync("Verifying reviewed head before GitHub write...", async () =>
        {
            await EnsureReviewIsCurrentAsync();
            var reviewedAt = DateTimeOffset.UtcNow;
            if (_currentPackage.Issue is not null)
            {
                await _github.UpdateIssueDeveloperBriefAsync(
                    _currentPackage.Issue.Number,
                    _review.Text.Trim(),
                    _reviewedHeadSha,
                    reviewedAt);
            }
            if (_currentPackage.PullRequest is not null)
            {
                await _github.PublishCommentAsync(
                    "PR",
                    _currentPackage.PullRequest.Number,
                    GitHubPublisher.FormatPrGuidance(_review.Text.Trim(), _reviewedHeadSha, reviewedAt));
            }
            SetStatus("Approved developer brief published to GitHub.");
        });
    }

    private async Task EnsureReviewIsCurrentAsync()
    {
        if (_github is null || _currentPackage?.PullRequest is null || string.IsNullOrWhiteSpace(_reviewedHeadSha)) return;
        var current = await _github.RefreshPrHeadAsync(_currentPackage.PullRequest.Number);
        if (!string.Equals(current, _reviewedHeadSha, StringComparison.OrdinalIgnoreCase))
        {
            _publish.Enabled = false;
            SetStatus($"Review stale — PR head changed from {_reviewedHeadSha[..Math.Min(12, _reviewedHeadSha.Length)]} to {current[..Math.Min(12, current.Length)]}. Refresh required.");
            throw new InvalidOperationException("The PR head changed after Pi reviewed it. Reload the work item and run Review with Pi again before publishing.");
        }
    }

    private async Task RefreshReadinessAsync()
    {
        var repositoryPath = _repositoryPath.Text.Trim();
        var workingDirectory = Directory.Exists(repositoryPath) ? repositoryPath : Environment.CurrentDirectory;
        _reviewStackReady = false;
        UpdateReviewAvailability();
        _refreshReadiness.Enabled = false;

        SetReadiness(_githubState, "GITHUB", ReadinessLevel.Checking, "CHECKING", "Checking GitHub CLI authentication.");
        SetReadiness(_repoState, "LOCAL REPO", ReadinessLevel.Checking, "CHECKING", "Checking the selected PlotPickle checkout.");
        SetReadiness(_nodeState, "NODE", ReadinessLevel.Checking, "CHECKING", "Checking Node.js availability.");
        SetReadiness(_piState, "PI", ReadinessLevel.Checking, "CHECKING", "Checking PlotPickle-managed Pi.");
        SetReadiness(_runtimeState, "LOCAL LLM", ReadinessLevel.Checking, "CHECKING", "Resolving a supported local coding runtime and model.");
        SetReadiness(_inferenceState, "INFERENCE", ReadinessLevel.Checking, "CHECKING", "Running the same bounded explicit-provider handshake used before Pi review.");
        SetStatus("Checking Developer Workbench readiness...");

        try
        {
            try
            {
                await ProcessRunner.RunAsync("gh", ["auth", "status", "-h", "github.com"], workingDirectory, TimeSpan.FromSeconds(30));
                SetReadiness(_githubState, "GITHUB", ReadinessLevel.Ready, "CONNECTED", "GitHub CLI authentication is valid. Loading Issues/PRs does not require Pi or a local LLM.");
            }
            catch (Exception error)
            {
                SetReadiness(_githubState, "GITHUB", ReadinessLevel.Failed, "RED", error.Message);
            }

            var repositoryReady = IsPlotPickleRepository(repositoryPath);
            SetReadiness(
                _repoState,
                "LOCAL REPO",
                repositoryReady ? ReadinessLevel.Ready : ReadinessLevel.Failed,
                repositoryReady ? "CURRENT" : "RED",
                repositoryReady
                    ? repositoryPath
                    : "The selected folder must contain PlotPickle AGENTS.md, package.json and scripts/pi-work-item-review.mjs.");

            var nodeReady = false;
            try
            {
                var nodeVersion = await ProcessRunner.RunAsync("node", ["--version"], workingDirectory, TimeSpan.FromSeconds(15));
                nodeReady = true;
                SetReadiness(_nodeState, "NODE", ReadinessLevel.Ready, nodeVersion, $"Node {nodeVersion} is available for the Pi bridge.");
            }
            catch (Exception error)
            {
                SetReadiness(_nodeState, "NODE", ReadinessLevel.Failed, "RED", error.Message);
            }

            if (!repositoryReady || !nodeReady)
            {
                var dependency = !repositoryReady ? "a current PlotPickle local repository" : "Node.js";
                SetReadiness(_piState, "PI", ReadinessLevel.Failed, "BLOCKED", $"Pi readiness requires {dependency}.");
                SetReadiness(_runtimeState, "LOCAL LLM", ReadinessLevel.Failed, "BLOCKED", $"Local runtime readiness requires {dependency}.");
                SetReadiness(_inferenceState, "INFERENCE", ReadinessLevel.Failed, "BLOCKED", $"Inference readiness requires {dependency}.");
                SetStatus("GitHub work can still be loaded when GitHub is connected. Pi review is blocked until the local review stack is ready.");
                return;
            }

            PiReadinessReport report;
            try
            {
                report = await PiReadinessProbe.RunAsync(repositoryPath);
            }
            catch (Exception error)
            {
                SetReadiness(_piState, "PI", ReadinessLevel.Failed, "RED", error.Message);
                SetReadiness(_runtimeState, "LOCAL LLM", ReadinessLevel.Failed, "RED", "The readiness probe could not resolve the local runtime because the Pi bridge itself failed.");
                SetReadiness(_inferenceState, "INFERENCE", ReadinessLevel.Failed, "RED", "The bounded inference handshake did not run.");
                SetStatus("Pi readiness probe failed. GitHub queue loading remains independent; Review with Pi is disabled.");
                return;
            }

            SetReadiness(
                _piState,
                "PI",
                report.Pi.Ready ? ReadinessLevel.Ready : ReadinessLevel.Failed,
                report.Pi.Ready ? report.Pi.Version : "RED",
                report.Pi.Detail);
            var runtimeSummary = report.Runtime.Ready
                ? string.Join(" · ", new[] { report.Runtime.Label, report.Runtime.Model }.Where(value => !string.IsNullOrWhiteSpace(value)))
                : "RED";
            SetReadiness(
                _runtimeState,
                "LOCAL LLM",
                report.Runtime.Ready ? ReadinessLevel.Ready : ReadinessLevel.Failed,
                runtimeSummary,
                report.Runtime.Detail);
            SetReadiness(
                _inferenceState,
                "INFERENCE",
                report.Inference.Ready ? ReadinessLevel.Ready : ReadinessLevel.Failed,
                report.Inference.Ready ? $"{report.Inference.LatencyMs} ms" : "RED",
                report.Inference.Detail);

            _reviewStackReady = report.Pi.Ready && report.Runtime.Ready && report.Inference.Ready;
            UpdateReviewAvailability();
            SetStatus(_reviewStackReady
                ? "Pi review stack is green. Select an Issue/PR; Review with Pi will enable when its evidence is ready."
                : "GitHub work can load, but Review with Pi stays disabled until PI, LOCAL LLM and INFERENCE are green. Hover a red light for detail.");
        }
        finally
        {
            _refreshReadiness.Enabled = true;
        }
    }

    private void InvalidateReadinessForRepositoryChange()
    {
        _reviewStackReady = false;
        _evidenceReady = false;
        UpdateReviewAvailability();
        SetReadiness(_repoState, "LOCAL REPO", ReadinessLevel.Unknown, "REFRESH", "Repository path changed. Refresh readiness before Pi review.");
        SetReadiness(_piState, "PI", ReadinessLevel.Unknown, "REFRESH", "Repository path changed. Refresh readiness before Pi review.");
        SetReadiness(_runtimeState, "LOCAL LLM", ReadinessLevel.Unknown, "REFRESH", "Repository path changed. Refresh readiness before Pi review.");
        SetReadiness(_inferenceState, "INFERENCE", ReadinessLevel.Unknown, "REFRESH", "Repository path changed. Refresh readiness before Pi review.");
    }

    private void UpdateReviewAvailability() => _reviewWithPi.Enabled = _evidenceReady && _reviewStackReady;

    private static bool IsPlotPickleRepository(string repositoryPath)
        => Directory.Exists(repositoryPath)
            && File.Exists(Path.Combine(repositoryPath, "AGENTS.md"))
            && File.Exists(Path.Combine(repositoryPath, "package.json"))
            && File.Exists(Path.Combine(repositoryPath, "scripts", "pi-work-item-review.mjs"));

    private static Label CreateReadinessLabel(string name) => new()
    {
        Text = $"{name} CHECKING",
        AutoSize = true,
        BorderStyle = BorderStyle.FixedSingle,
        Padding = new Padding(7, 4, 7, 4),
        Margin = new Padding(0, 2, 6, 2),
        ForeColor = Color.White,
        BackColor = Color.DimGray,
    };

    private void SetReadiness(Label label, string name, ReadinessLevel level, string summary, string detail)
    {
        var state = level switch
        {
            ReadinessLevel.Ready => "GREEN",
            ReadinessLevel.Failed => "RED",
            ReadinessLevel.Checking => "CHECKING",
            _ => "UNKNOWN",
        };
        label.Text = string.IsNullOrWhiteSpace(summary) ? $"{name} {state}" : $"{name} {state} · {summary}";
        label.ForeColor = Color.White;
        label.BackColor = level switch
        {
            ReadinessLevel.Ready => Color.DarkGreen,
            ReadinessLevel.Failed => Color.DarkRed,
            ReadinessLevel.Checking => Color.DarkGoldenrod,
            _ => Color.DimGray,
        };
        _readinessDetails.SetToolTip(label, string.IsNullOrWhiteSpace(detail) ? label.Text : detail);
    }

    private async Task RunUiTaskAsync(string message, Func<Task> action)
    {
        try
        {
            UseWaitCursor = true;
            _load.Enabled = false;
            SetStatus(message);
            await action();
        }
        catch (Exception error)
        {
            SetStatus("Stopped: " + error.Message.Split('\n')[0]);
            MessageBox.Show(this, error.Message, Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            _load.Enabled = true;
            UseWaitCursor = false;
        }
    }

    private void SetStatus(string message) => _status.Text = message;
}

internal sealed class GitHubClient(string repository, string repositoryPath)
{
    private const int MaxDiffCharacters = 160_000;
    private static readonly Regex ClosingReference = new(@"(?i)(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:issue\s*)?#(?<number>\d+)", RegexOptions.Compiled);

    public async Task CheckAuthAsync()
    {
        await ProcessRunner.RunAsync("gh", ["auth", "status", "-h", "github.com"], repositoryPath, TimeSpan.FromSeconds(30));
    }

    public async Task<List<WorkItem>> ListOpenItemsAsync()
    {
        var issueTask = ProcessRunner.RunAsync("gh", ["issue", "list", "--repo", repository, "--state", "open", "--limit", "100", "--json", "number,title,updatedAt,url,body"], repositoryPath, TimeSpan.FromMinutes(2));
        var prTask = ProcessRunner.RunAsync("gh", ["pr", "list", "--repo", repository, "--state", "open", "--limit", "100", "--json", "number,title,updatedAt,url,body,headRefName,headRefOid,baseRefName,isDraft,mergeStateStatus,statusCheckRollup"], repositoryPath, TimeSpan.FromMinutes(2));
        await Task.WhenAll(issueTask, prTask);

        var items = new List<WorkItem>();
        using (var doc = JsonDocument.Parse(issueTask.Result))
        {
            foreach (var element in doc.RootElement.EnumerateArray())
            {
                items.Add(new WorkItem
                {
                    Kind = "Issue",
                    Number = GetInt(element, "number"),
                    Title = GetString(element, "title"),
                    Body = GetString(element, "body"),
                    Url = GetString(element, "url"),
                    UpdatedAt = GetDate(element, "updatedAt"),
                    Status = "OPEN",
                });
            }
        }
        using (var doc = JsonDocument.Parse(prTask.Result))
        {
            foreach (var element in doc.RootElement.EnumerateArray())
            {
                var body = GetString(element, "body");
                var checks = ParseChecks(element.TryGetProperty("statusCheckRollup", out var rollup) ? rollup : default);
                var item = new WorkItem
                {
                    Kind = "PR",
                    Number = GetInt(element, "number"),
                    Title = GetString(element, "title"),
                    Body = body,
                    Url = GetString(element, "url"),
                    UpdatedAt = GetDate(element, "updatedAt"),
                    HeadSha = GetString(element, "headRefOid"),
                    HeadBranch = GetString(element, "headRefName"),
                    BaseBranch = GetString(element, "baseRefName"),
                    Status = SummarizeChecks(checks, GetString(element, "mergeStateStatus"), GetBool(element, "isDraft")),
                    LinkedIssueNumber = ParseClosingIssue(body),
                };
                items.Add(item);
            }
        }

        var issues = items.Where(item => item.Kind == "Issue").ToDictionary(item => item.Number);
        foreach (var pr in items.Where(item => item.Kind == "PR" && item.LinkedIssueNumber.HasValue))
        {
            if (issues.TryGetValue(pr.LinkedIssueNumber!.Value, out var issue) && !issue.LinkedPrNumber.HasValue)
            {
                issue.LinkedPrNumber = pr.Number;
            }
        }
        return items;
    }

    public async Task<ReviewPackage> GetReviewPackageAsync(WorkItem selected, IReadOnlyList<WorkItem> queue)
    {
        WorkItemEvidence? issue = null;
        WorkItemEvidence? pr = null;

        if (selected.Kind == "Issue")
        {
            issue = await GetIssueEvidenceAsync(selected.Number);
            var linkedPr = selected.LinkedPrNumber ?? queue.FirstOrDefault(item => item.Kind == "PR" && item.LinkedIssueNumber == selected.Number)?.Number;
            if (linkedPr.HasValue) pr = await GetPrEvidenceAsync(linkedPr.Value);
        }
        else
        {
            pr = await GetPrEvidenceAsync(selected.Number);
            var linkedIssue = pr.LinkedIssueNumbers.FirstOrDefault();
            if (linkedIssue <= 0) linkedIssue = selected.LinkedIssueNumber ?? 0;
            if (linkedIssue > 0) issue = await GetIssueEvidenceAsync(linkedIssue);
        }

        if (pr is not null && issue is null && pr.LinkedIssueNumbers.Count > 0)
        {
            issue = await GetIssueEvidenceAsync(pr.LinkedIssueNumbers[0]);
        }

        return new ReviewPackage
        {
            Repository = repository,
            RepositoryPath = repositoryPath,
            GeneratedAt = DateTimeOffset.UtcNow,
            SelectedKind = selected.Kind,
            SelectedNumber = selected.Number,
            Issue = issue,
            PullRequest = pr,
        };
    }

    private async Task<WorkItemEvidence> GetIssueEvidenceAsync(int number)
    {
        var raw = await ProcessRunner.RunAsync("gh", ["issue", "view", number.ToString(), "--repo", repository, "--json", "number,title,body,comments,labels,assignees,state,url,updatedAt"], repositoryPath, TimeSpan.FromMinutes(2));
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;
        return new WorkItemEvidence
        {
            Kind = "Issue",
            Number = GetInt(root, "number"),
            Title = GetString(root, "title"),
            Body = Limit(GetString(root, "body"), 60_000),
            Url = GetString(root, "url"),
            UpdatedAt = GetDate(root, "updatedAt"),
            State = GetString(root, "state"),
            Comments = ParseComments(root.TryGetProperty("comments", out var comments) ? comments : default),
        };
    }

    private async Task<WorkItemEvidence> GetPrEvidenceAsync(int number)
    {
        var raw = await ProcessRunner.RunAsync("gh", ["pr", "view", number.ToString(), "--repo", repository, "--json", "number,title,body,comments,commits,files,headRefName,headRefOid,baseRefName,isDraft,mergeStateStatus,statusCheckRollup,url,updatedAt,closingIssuesReferences"], repositoryPath, TimeSpan.FromMinutes(2));
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;
        string diff;
        try
        {
            diff = await ProcessRunner.RunAsync("gh", ["pr", "diff", number.ToString(), "--repo", repository, "--patch"], repositoryPath, TimeSpan.FromMinutes(3));
        }
        catch (Exception error)
        {
            diff = "[PR diff unavailable: " + error.Message.Split('\n')[0] + "]";
        }
        if (diff.Length > MaxDiffCharacters) diff = diff[..MaxDiffCharacters] + "\n[Diff truncated by Developer Workbench context budget.]";

        return new WorkItemEvidence
        {
            Kind = "PR",
            Number = GetInt(root, "number"),
            Title = GetString(root, "title"),
            Body = Limit(GetString(root, "body"), 60_000),
            Url = GetString(root, "url"),
            UpdatedAt = GetDate(root, "updatedAt"),
            State = GetBool(root, "isDraft") ? "DRAFT" : GetString(root, "mergeStateStatus"),
            HeadSha = GetString(root, "headRefOid"),
            HeadBranch = GetString(root, "headRefName"),
            BaseBranch = GetString(root, "baseRefName"),
            Comments = ParseComments(root.TryGetProperty("comments", out var comments) ? comments : default),
            Commits = ParseCommits(root.TryGetProperty("commits", out var commits) ? commits : default),
            Files = ParseFiles(root.TryGetProperty("files", out var files) ? files : default),
            Checks = ParseChecks(root.TryGetProperty("statusCheckRollup", out var checks) ? checks : default),
            LinkedIssueNumbers = ParseLinkedIssues(root.TryGetProperty("closingIssuesReferences", out var links) ? links : default),
            Diff = diff,
        };
    }

    public async Task<string> RefreshPrHeadAsync(int number)
    {
        var raw = await ProcessRunner.RunAsync("gh", ["pr", "view", number.ToString(), "--repo", repository, "--json", "headRefOid"], repositoryPath, TimeSpan.FromMinutes(1));
        using var doc = JsonDocument.Parse(raw);
        return GetString(doc.RootElement, "headRefOid");
    }

    public async Task PublishCommentAsync(string kind, int number, string body)
    {
        var temp = Path.Combine(Path.GetTempPath(), $"plotpickle-workbench-comment-{Guid.NewGuid():N}.md");
        try
        {
            await File.WriteAllTextAsync(temp, body, new UTF8Encoding(false));
            var command = string.Equals(kind, "PR", StringComparison.OrdinalIgnoreCase) ? "pr" : "issue";
            await ProcessRunner.RunAsync("gh", [command, "comment", number.ToString(), "--repo", repository, "--body-file", temp], repositoryPath, TimeSpan.FromMinutes(2));
        }
        finally
        {
            TryDelete(temp);
        }
    }

    public async Task UpdateIssueDeveloperBriefAsync(int number, string brief, string reviewedHeadSha, DateTimeOffset reviewedAt)
    {
        var raw = await ProcessRunner.RunAsync("gh", ["issue", "view", number.ToString(), "--repo", repository, "--json", "body"], repositoryPath, TimeSpan.FromMinutes(1));
        using var doc = JsonDocument.Parse(raw);
        var existing = GetString(doc.RootElement, "body");
        var replacement = GitHubPublisher.FormatIssueBrief(brief, reviewedHeadSha, reviewedAt);
        var updated = GitHubPublisher.UpsertDelimitedSection(existing, replacement);
        var temp = Path.Combine(Path.GetTempPath(), $"plotpickle-workbench-issue-{Guid.NewGuid():N}.md");
        try
        {
            await File.WriteAllTextAsync(temp, updated, new UTF8Encoding(false));
            await ProcessRunner.RunAsync("gh", ["issue", "edit", number.ToString(), "--repo", repository, "--body-file", temp], repositoryPath, TimeSpan.FromMinutes(2));
        }
        finally
        {
            TryDelete(temp);
        }
    }

    private static int? ParseClosingIssue(string body)
    {
        var match = ClosingReference.Match(body ?? string.Empty);
        return match.Success && int.TryParse(match.Groups["number"].Value, out var number) ? number : null;
    }

    private static string SummarizeChecks(IReadOnlyList<ReviewCheck> checks, string mergeState, bool draft)
    {
        if (draft) return "DRAFT";
        if (checks.Any(check => ReviewCheck.IsFailure(check.Conclusion) || ReviewCheck.IsFailure(check.Status))) return "RED";
        if (checks.Any(check => ReviewCheck.IsPending(check.Status) || ReviewCheck.IsPending(check.Conclusion))) return "PENDING";
        if (string.Equals(mergeState, "BLOCKED", StringComparison.OrdinalIgnoreCase)) return "BLOCKED";
        return checks.Count > 0 ? "GREEN" : string.IsNullOrWhiteSpace(mergeState) ? "OPEN" : mergeState.ToUpperInvariant();
    }

    private static List<ReviewComment> ParseComments(JsonElement value)
    {
        var result = new List<ReviewComment>();
        if (value.ValueKind != JsonValueKind.Array) return result;
        foreach (var element in value.EnumerateArray().TakeLast(40))
        {
            var author = element.TryGetProperty("author", out var authorValue) && authorValue.ValueKind == JsonValueKind.Object
                ? GetString(authorValue, "login")
                : string.Empty;
            result.Add(new ReviewComment
            {
                Author = author,
                CreatedAt = GetDate(element, "createdAt"),
                Body = Limit(GetString(element, "body"), 12_000),
                Url = GetString(element, "url"),
            });
        }
        return result;
    }

    private static List<ReviewCommit> ParseCommits(JsonElement value)
    {
        var result = new List<ReviewCommit>();
        if (value.ValueKind != JsonValueKind.Array) return result;
        foreach (var element in value.EnumerateArray().TakeLast(80))
        {
            result.Add(new ReviewCommit
            {
                Oid = GetString(element, "oid"),
                Message = GetString(element, "messageHeadline"),
                CommittedAt = GetDate(element, "committedDate"),
            });
        }
        return result;
    }

    private static List<ReviewFile> ParseFiles(JsonElement value)
    {
        var result = new List<ReviewFile>();
        if (value.ValueKind != JsonValueKind.Array) return result;
        foreach (var element in value.EnumerateArray().Take(250))
        {
            result.Add(new ReviewFile
            {
                Path = GetString(element, "path"),
                Additions = GetInt(element, "additions"),
                Deletions = GetInt(element, "deletions"),
            });
        }
        return result;
    }

    private static List<ReviewCheck> ParseChecks(JsonElement value)
    {
        var result = new List<ReviewCheck>();
        if (value.ValueKind != JsonValueKind.Array) return result;
        foreach (var element in value.EnumerateArray())
        {
            var name = FirstString(element, "name", "context", "workflowName");
            var status = FirstString(element, "status", "state");
            var conclusion = FirstString(element, "conclusion");
            result.Add(new ReviewCheck { Name = name, Status = status, Conclusion = conclusion });
        }
        return result;
    }

    private static List<int> ParseLinkedIssues(JsonElement value)
    {
        var result = new List<int>();
        if (value.ValueKind != JsonValueKind.Array) return result;
        foreach (var element in value.EnumerateArray())
        {
            var number = GetInt(element, "number");
            if (number > 0) result.Add(number);
        }
        return result;
    }

    private static string FirstString(JsonElement element, params string[] names)
    {
        foreach (var name in names)
        {
            var value = GetString(element, name);
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }
        return string.Empty;
    }

    private static string GetString(JsonElement element, string name)
        => element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? string.Empty
            : string.Empty;

    private static int GetInt(JsonElement element, string name)
        => element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.TryGetInt32(out var number) ? number : 0;

    private static bool GetBool(JsonElement element, string name)
        => element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;

    private static DateTimeOffset GetDate(JsonElement element, string name)
    {
        var raw = GetString(element, name);
        return DateTimeOffset.TryParse(raw, out var value) ? value : DateTimeOffset.MinValue;
    }

    private static string Limit(string text, int max) => text.Length <= max ? text : text[..max] + "\n[truncated by Developer Workbench]";

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }
}

internal static class GitHubPublisher
{
    public const string StartMarker = "<!-- PLOTPICKLE-DEVELOPER-WORKBENCH-BRIEF-START -->";
    public const string EndMarker = "<!-- PLOTPICKLE-DEVELOPER-WORKBENCH-BRIEF-END -->";

    public static string FormatIssueBrief(string brief, string reviewedHeadSha, DateTimeOffset reviewedAt)
    {
        var head = string.IsNullOrWhiteSpace(reviewedHeadSha) ? "n/a (Issue-only review)" : reviewedHeadSha;
        return string.Join("\n", [
            StartMarker,
            "## Current developer brief",
            $"Developer Workbench review: {reviewedAt:O}",
            $"Reviewed exact PR head: `{head}`",
            string.Empty,
            brief.Trim(),
            EndMarker,
        ]);
    }

    public static string FormatPrGuidance(string brief, string reviewedHeadSha, DateTimeOffset reviewedAt)
    {
        var head = string.IsNullOrWhiteSpace(reviewedHeadSha) ? "n/a" : reviewedHeadSha;
        return string.Join("\n", [
            "## Developer Workbench guidance",
            $"Reviewed: {reviewedAt:O}",
            $"Exact reviewed head: `{head}`",
            string.Empty,
            brief.Trim(),
        ]);
    }

    public static string UpsertDelimitedSection(string original, string replacement)
    {
        var start = original.IndexOf(StartMarker, StringComparison.Ordinal);
        var end = original.IndexOf(EndMarker, StringComparison.Ordinal);
        if (start >= 0 && end >= start)
        {
            end += EndMarker.Length;
            return original[..start].TrimEnd() + "\n\n" + replacement.Trim() + "\n" + original[end..].TrimStart();
        }
        return original.TrimEnd() + "\n\n" + replacement.Trim() + "\n";
    }
}

internal sealed class PiReviewRunner(string repositoryPath)
{
    public async Task<string> RunAsync(ReviewPackage reviewPackage)
    {
        var script = Path.Combine(repositoryPath, "scripts", "pi-work-item-review.mjs");
        if (!File.Exists(script)) throw new FileNotFoundException("Pi work-item review bridge is missing from this repository checkout.", script);
        var tempRoot = Path.Combine(Path.GetTempPath(), "PlotPickle", "DeveloperWorkbench", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempRoot);
        var input = Path.Combine(tempRoot, "review-package.json");
        var output = Path.Combine(tempRoot, "developer-brief.md");
        try
        {
            await File.WriteAllTextAsync(input, JsonSerializer.Serialize(reviewPackage, JsonOptions.Indented), new UTF8Encoding(false));
            await ProcessRunner.RunAsync("node", [script, "--input", input, "--output", output], repositoryPath, TimeSpan.FromMinutes(18));
            if (!File.Exists(output)) throw new InvalidOperationException("Pi completed without writing the expected developer brief.");
            var result = await File.ReadAllTextAsync(output);
            if (string.IsNullOrWhiteSpace(result)) throw new InvalidOperationException("Pi produced an empty developer brief.");
            return result.Trim();
        }
        finally
        {
            try { Directory.Delete(tempRoot, true); } catch { }
        }
    }
}

internal static class PiReadinessProbe
{
    public static async Task<PiReadinessReport> RunAsync(string repositoryPath)
    {
        var script = Path.Combine(repositoryPath, "scripts", "pi-work-item-review.mjs");
        if (!File.Exists(script)) throw new FileNotFoundException("Pi work-item review bridge is missing from this repository checkout.", script);
        var raw = await ProcessRunner.RunAsync(
            "node",
            [script, "--readiness", "--repository-path", repositoryPath],
            repositoryPath,
            TimeSpan.FromMinutes(16));
        var report = JsonSerializer.Deserialize<PiReadinessReport>(raw, JsonOptions.Standard);
        return report ?? throw new InvalidOperationException("Pi readiness probe returned invalid JSON.");
    }
}

internal static class ProcessRunner
{
    public static async Task<string> RunAsync(string command, IEnumerable<string> arguments, string workingDirectory, TimeSpan timeout)
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
        using var process = new Process { StartInfo = start };
        try
        {
            if (!process.Start()) throw new InvalidOperationException($"Could not start {command}.");
        }
        catch (Exception error)
        {
            throw new InvalidOperationException($"Could not start {command}. Ensure it is installed and available on PATH. {error.Message}", error);
        }

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
            throw new TimeoutException($"{command} exceeded the {timeout.TotalMinutes:0.#}-minute Developer Workbench timeout.");
        }
        var output = await stdout;
        var errorOutput = await stderr;
        if (process.ExitCode != 0)
        {
            var detail = string.IsNullOrWhiteSpace(errorOutput) ? output : errorOutput;
            throw new InvalidOperationException($"{command} exited with code {process.ExitCode}.\n{Limit(detail.Trim(), 8000)}");
        }
        return output.Trim();
    }

    private static string Limit(string text, int max) => text.Length <= max ? text : text[..max] + "\n[output truncated]";
}

internal static class EvidenceRenderer
{
    public static string Render(ReviewPackage package)
    {
        var builder = new StringBuilder();
        builder.AppendLine($"Repository: {package.Repository}");
        builder.AppendLine($"Collected: {package.GeneratedAt:O}");
        builder.AppendLine($"Selected: {package.SelectedKind} #{package.SelectedNumber}");
        builder.AppendLine();
        if (package.Issue is not null) AppendItem(builder, package.Issue);
        if (package.PullRequest is not null) AppendItem(builder, package.PullRequest);
        return builder.ToString();
    }

    private static void AppendItem(StringBuilder builder, WorkItemEvidence item)
    {
        builder.AppendLine(new string('=', 72));
        builder.AppendLine($"{item.Kind} #{item.Number}: {item.Title}");
        builder.AppendLine(item.Url);
        builder.AppendLine($"State: {item.State}    Updated: {item.UpdatedAt:O}");
        if (item.Kind == "PR")
        {
            builder.AppendLine($"Base: {item.BaseBranch}    Head: {item.HeadBranch}");
            builder.AppendLine($"Exact head SHA: {item.HeadSha}");
            if (item.LinkedIssueNumbers.Count > 0) builder.AppendLine($"Closing Issues: {string.Join(", ", item.LinkedIssueNumbers.Select(number => "#" + number))}");
        }
        builder.AppendLine();
        builder.AppendLine("BODY");
        builder.AppendLine(item.Body);
        builder.AppendLine();
        if (item.Checks.Count > 0)
        {
            builder.AppendLine("CHECKS");
            foreach (var check in item.Checks) builder.AppendLine($"- {check.Name}: {check.Status} {check.Conclusion}".TrimEnd());
            builder.AppendLine();
        }
        if (item.Files.Count > 0)
        {
            builder.AppendLine("CHANGED FILES");
            foreach (var file in item.Files) builder.AppendLine($"- {file.Path} (+{file.Additions}/-{file.Deletions})");
            builder.AppendLine();
        }
        if (item.Commits.Count > 0)
        {
            builder.AppendLine("RECENT COMMITS");
            foreach (var commit in item.Commits) builder.AppendLine($"- {Short(commit.Oid)} {commit.Message}");
            builder.AppendLine();
        }
        if (item.Comments.Count > 0)
        {
            builder.AppendLine("RECENT COMMENTS");
            foreach (var comment in item.Comments)
            {
                builder.AppendLine($"[{comment.CreatedAt:O}] {comment.Author}");
                builder.AppendLine(comment.Body);
                builder.AppendLine();
            }
        }
    }

    private static string Short(string value) => string.IsNullOrWhiteSpace(value) ? "" : value[..Math.Min(12, value.Length)];
}

internal static class SettingsStore
{
    private static readonly string SettingsDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PlotPickle", "DeveloperWorkbench");
    private static readonly string SettingsPath = Path.Combine(SettingsDirectory, "settings.json");

    public static WorkbenchSettings Load()
    {
        try
        {
            if (File.Exists(SettingsPath))
            {
                var loaded = JsonSerializer.Deserialize<WorkbenchSettings>(File.ReadAllText(SettingsPath), JsonOptions.Standard);
                if (loaded is not null) return loaded;
            }
        }
        catch { }
        return new WorkbenchSettings("BryanHarrisScripts/PlotPickle", RepositoryLocator.FindPlotPickleRoot());
    }

    public static void Save(WorkbenchSettings settings)
    {
        Directory.CreateDirectory(SettingsDirectory);
        File.WriteAllText(SettingsPath, JsonSerializer.Serialize(settings, JsonOptions.Indented), new UTF8Encoding(false));
    }
}

internal static class RepositoryLocator
{
    public static string FindPlotPickleRoot()
    {
        foreach (var start in new[] { AppContext.BaseDirectory, Environment.CurrentDirectory })
        {
            var current = new DirectoryInfo(start);
            for (var depth = 0; depth < 10 && current is not null; depth++, current = current.Parent)
            {
                if (File.Exists(Path.Combine(current.FullName, "AGENTS.md")) && File.Exists(Path.Combine(current.FullName, "package.json"))) return current.FullName;
            }
        }
        return string.Empty;
    }
}

internal static class WorkbenchBuildIdentity
{
    public static string Current { get; } = Resolve();

    private static string Resolve()
    {
        var value = typeof(Program).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        return string.IsNullOrWhiteSpace(value) ? "build-local · sha-unknown" : value.Replace(";", " · ", StringComparison.Ordinal);
    }
}

internal static class JsonOptions
{
    public static readonly JsonSerializerOptions Standard = new() { PropertyNameCaseInsensitive = true };
    public static readonly JsonSerializerOptions Indented = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true };
}

internal enum ReadinessLevel
{
    Unknown,
    Checking,
    Ready,
    Failed,
}

internal sealed record WorkbenchSettings(string Repository, string RepositoryPath);

internal sealed class PiReadinessReport
{
    public int SchemaVersion { get; set; }
    public bool Ready { get; set; }
    public PiReadinessComponent Pi { get; set; } = new();
    public PiRuntimeReadiness Runtime { get; set; } = new();
    public PiInferenceReadiness Inference { get; set; } = new();
}

internal sealed class PiReadinessComponent
{
    public bool Ready { get; set; }
    public string Version { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
}

internal sealed class PiRuntimeReadiness
{
    public bool Ready { get; set; }
    public string Label { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
}

internal sealed class PiInferenceReadiness
{
    public bool Ready { get; set; }
    public int LatencyMs { get; set; }
    public string ProviderId { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
}

internal sealed class WorkItem
{
    public string Kind { get; set; } = string.Empty;
    public int Number { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public DateTimeOffset UpdatedAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string HeadSha { get; set; } = string.Empty;
    public string HeadBranch { get; set; } = string.Empty;
    public string BaseBranch { get; set; } = string.Empty;
    public int? LinkedIssueNumber { get; set; }
    public int? LinkedPrNumber { get; set; }
}

internal sealed class ReviewPackage
{
    public string Repository { get; set; } = string.Empty;
    public string RepositoryPath { get; set; } = string.Empty;
    public DateTimeOffset GeneratedAt { get; set; }
    public string SelectedKind { get; set; } = string.Empty;
    public int SelectedNumber { get; set; }
    public WorkItemEvidence? Issue { get; set; }
    public WorkItemEvidence? PullRequest { get; set; }
}

internal sealed class WorkItemEvidence
{
    public string Kind { get; set; } = string.Empty;
    public int Number { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public DateTimeOffset UpdatedAt { get; set; }
    public string State { get; set; } = string.Empty;
    public string HeadSha { get; set; } = string.Empty;
    public string HeadBranch { get; set; } = string.Empty;
    public string BaseBranch { get; set; } = string.Empty;
    public List<ReviewComment> Comments { get; set; } = [];
    public List<ReviewCommit> Commits { get; set; } = [];
    public List<ReviewFile> Files { get; set; } = [];
    public List<ReviewCheck> Checks { get; set; } = [];
    public List<int> LinkedIssueNumbers { get; set; } = [];
    public string Diff { get; set; } = string.Empty;
}

internal sealed class ReviewComment
{
    public string Author { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public string Body { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
}

internal sealed class ReviewCommit
{
    public string Oid { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTimeOffset CommittedAt { get; set; }
}

internal sealed class ReviewFile
{
    public string Path { get; set; } = string.Empty;
    public int Additions { get; set; }
    public int Deletions { get; set; }
}

internal sealed class ReviewCheck
{
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Conclusion { get; set; } = string.Empty;

    public static bool IsFailure(string value) => value.ToUpperInvariant() is "FAILURE" or "FAILED" or "ERROR" or "CANCELLED" or "TIMED_OUT" or "ACTION_REQUIRED";
    public static bool IsPending(string value) => value.ToUpperInvariant() is "PENDING" or "QUEUED" or "IN_PROGRESS" or "WAITING" or "REQUESTED";
}
