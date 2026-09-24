using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using OnMe.Api.Data;

namespace OnMe.Api.Pages;

public class IndexModel(AppDbContext db) : PageModel
{
    public Dictionary<string, string?> Settings { get; private set; } = new();

    public async Task OnGetAsync()
    {
        Settings = await db.SiteSettings.ToDictionaryAsync(s => s.Key, s => s.Value);
    }

    public string Setting(string key, string fallback)
        => Settings.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v! : fallback;
}
