global using Path = PlotPickle.DeveloperWorkbench.WorkbenchPath;

namespace PlotPickle.DeveloperWorkbench;

internal static class WorkbenchPath
{
    private static readonly HashSet<string> PackagedReviewerHelpers = new(StringComparer.OrdinalIgnoreCase)
    {
        "Utilities/DeveloperWorkbench/local-reviewer-inventory.mjs",
        "Utilities/DeveloperWorkbench/local-gate-status.mjs",
        "Utilities/DeveloperWorkbench/second-opinion-review.mjs",
        "Utilities/DeveloperWorkbench/workbench-repomix-evidence.mjs",
    };

    public static string Combine(params string[] paths)
    {
        var regular = System.IO.Path.Combine(paths);
        if (paths.Length < 2 || File.Exists(regular)) return regular;

        var relative = string.Join('/', paths.Skip(1)).Replace('\\', '/');
        if (!PackagedReviewerHelpers.Contains(relative)) return regular;

        var packaged = System.IO.Path.Combine(
            new[] { AppContext.BaseDirectory }
                .Concat(relative.Split('/', StringSplitOptions.RemoveEmptyEntries))
                .ToArray());
        return File.Exists(packaged) ? packaged : regular;
    }

    public static string GetTempPath() => System.IO.Path.GetTempPath();
}
