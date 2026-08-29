using System.Diagnostics;
using System.Text;
using System.Windows.Forms;

namespace PlotPickle.Launcher;

internal static class Program
{
    private const string ProductName = "PlotPickle";

    [STAThread]
    private static int Main(string[] args)
    {
        var appDirectory = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var plotPickleHome = Path.Combine(localAppData, ProductName);
        var logDirectory = Path.Combine(plotPickleHome, "logs");
        var logPath = Path.Combine(logDirectory, "launcher.log");

        try
        {
            Directory.CreateDirectory(logDirectory);

            if (args.Any(argument => argument.Equals("--verify-install", StringComparison.OrdinalIgnoreCase)))
            {
                VerifyInstalledPayload(appDirectory);
                File.AppendAllText(logPath, $"{DateTimeOffset.Now:u} Installer payload verification passed.{Environment.NewLine}", Encoding.UTF8);
                return 0;
            }

            VerifyInstalledPayload(appDirectory);
            return RunHiddenLauncher(appDirectory, plotPickleHome, logPath, args);
        }
        catch (Exception error)
        {
            try
            {
                Directory.CreateDirectory(logDirectory);
                File.AppendAllText(logPath, $"{DateTimeOffset.Now:u} {error}{Environment.NewLine}", Encoding.UTF8);
            }
            catch
            {
                // The message box below is still useful if logging itself is unavailable.
            }

            MessageBox.Show(
                $"PlotPickle could not start.\n\n{error.Message}\n\nDiagnostics: {logPath}",
                ProductName,
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }
    }

    private static void VerifyInstalledPayload(string appDirectory)
    {
        var requiredFiles = new[]
        {
            Path.Combine(appDirectory, "Start-PlotPickle.bat"),
            Path.Combine(appDirectory, "package.json"),
            Path.Combine(appDirectory, "runtime", "node", "node.exe"),
            Path.Combine(appDirectory, "runtime", "node", "npm.cmd"),
            Path.Combine(appDirectory, "node_modules", "vite", "package.json"),
            Path.Combine(appDirectory, "config", "github-app.json"),
            Path.Combine(appDirectory, "config", "google-oauth.json"),
        };

        var missing = requiredFiles.Where(file => !File.Exists(file)).ToArray();
        if (missing.Length > 0)
        {
            throw new InvalidOperationException(
                "The PlotPickle installation is incomplete. Missing: " +
                string.Join(", ", missing.Select(Path.GetFileName)));
        }
    }

    private static int RunHiddenLauncher(string appDirectory, string plotPickleHome, string logPath, string[] args)
    {
        var commandProcessor = Environment.GetEnvironmentVariable("ComSpec")
            ?? Path.Combine(Environment.SystemDirectory, "cmd.exe");
        var launcher = Path.Combine(appDirectory, "Start-PlotPickle.bat");
        var bundledNode = Path.Combine(appDirectory, "runtime", "node");

        var startInfo = new ProcessStartInfo
        {
            FileName = commandProcessor,
            WorkingDirectory = appDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        startInfo.ArgumentList.Add("/d");
        startInfo.ArgumentList.Add("/s");
        startInfo.ArgumentList.Add("/c");
        startInfo.ArgumentList.Add($"\"{launcher}\" --installed");

        var existingPath = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        startInfo.Environment["PATH"] = bundledNode + Path.PathSeparator + existingPath;
        startInfo.Environment["PLOTPICKLE_HOME"] = plotPickleHome;
        startInfo.Environment["PLOTPICKLE_INSTALLED"] = "1";
        startInfo.Environment["PLOTPICKLE_NATIVE_LAUNCHER"] = "1";
        startInfo.Environment["PLOTPICKLE_LAUNCHER_LOG"] = logPath;
        if (args.Any(argument => argument.Equals("--diagnostics", StringComparison.OrdinalIgnoreCase)))
        {
            startInfo.Environment["PLOTPICKLE_DIAGNOSTICS"] = "1";
        }

        using var log = new StreamWriter(logPath, append: true, Encoding.UTF8) { AutoFlush = true };
        var gate = new object();
        log.WriteLine($"{DateTimeOffset.Now:u} Launching installed PlotPickle from {appDirectory}");

        using var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        process.OutputDataReceived += (_, eventArgs) => WriteLogLine(log, gate, eventArgs.Data);
        process.ErrorDataReceived += (_, eventArgs) => WriteLogLine(log, gate, eventArgs.Data);

        if (!process.Start()) throw new InvalidOperationException("Windows could not start the PlotPickle runtime.");
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        // Hidden legacy startup error paths still contain `pause`. Feed harmless newlines so
        // an installer launch can never wait forever on an invisible prompt.
        process.StandardInput.WriteLine();
        process.StandardInput.WriteLine();
        process.StandardInput.Close();

        process.WaitForExit();
        log.WriteLine($"{DateTimeOffset.Now:u} PlotPickle launcher exited with code {process.ExitCode}.");

        if (process.ExitCode != 0)
        {
            MessageBox.Show(
                $"PlotPickle stopped before it was ready.\n\nDiagnostics were saved to:\n{logPath}",
                ProductName,
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
        }
        return process.ExitCode;
    }

    private static void WriteLogLine(StreamWriter log, object gate, string? line)
    {
        if (line is null) return;
        lock (gate) log.WriteLine(line);
    }
}
