using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OnMe.Api.Data;
using OnMe.Api.Dtos;
using OnMe.Api.Models;

namespace OnMe.Api.Endpoints;

public static class PublicEndpoints
{
    private static readonly string[] AllowedLocations = ["inside_saudi", "outside_saudi", "unsure"];

    public static void MapPublic(this WebApplication app)
    {
        // إرسال طلب جديد — عام مع RateLimiting
        app.MapPost("/api/leads", async ([FromBody] CreateLeadDto dto, AppDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(dto.Name) || dto.Name.Trim().Length < 2 || dto.Name.Trim().Length > 120)
                return Results.BadRequest(new { message = "Name must be 2-120 characters." });
            if (!Regex.IsMatch((dto.Phone ?? "").Trim(), @"^05\d{8}$"))
                return Results.BadRequest(new { message = "Phone must match 05XXXXXXXX." });
            if (string.IsNullOrWhiteSpace(dto.Description) || dto.Description.Trim().Length < 10 || dto.Description.Trim().Length > 5000)
                return Results.BadRequest(new { message = "Description must be 10-5000 characters." });
            var location = string.IsNullOrWhiteSpace(dto.Location) ? null : dto.Location.Trim();
            if (location is not null && !AllowedLocations.Contains(location))
                return Results.BadRequest(new { message = "Invalid location value." });

            var lead = new Lead
            {
                Name = dto.Name.Trim(),
                Phone = dto.Phone.Trim(),
                Description = dto.Description.Trim(),
                Location = location,
                Status = LeadStatuses.New,
                RefCode = "OM-" + DateTime.UtcNow.ToString("yyyyMMdd") + "-" + Random.Shared.Next(1000, 9999),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            db.Leads.Add(lead);
            await db.SaveChangesAsync();
            return Results.Created($"/api/admin/leads/{lead.Id}", new { id = lead.Id, @ref = lead.RefCode });
        })
        .RequireRateLimiting("leads")
        .WithName("CreateLead")
        .WithSummary("Submit a new task request");

        // قراءة المحتوى العام (للواجهة المستقبلية المرتبطة بالـ CMS)
        app.MapGet("/api/content", async (AppDbContext db) =>
        {
            var settings = await db.SiteSettings.ToDictionaryAsync(s => s.Key, s => s.Value);

            // إذا لم يُضبط الفيديو يدويًا، نأخذ تلقائيًا آخر فيديو مرفوع في الوسائط
            if (string.IsNullOrWhiteSpace(settings.GetValueOrDefault("hero_video_url")))
            {
                var latestVideo = await db.MediaFiles
                    .Where(m => m.Kind == "video")
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => m.Url)
                    .FirstOrDefaultAsync();
                if (!string.IsNullOrWhiteSpace(latestVideo))
                    settings["hero_video_url"] = latestVideo;
            }

            return Results.Ok(new
            {
                // Read-only on every page load: AsNoTracking skips change-tracking memory
                sections = await db.PageSections.AsNoTracking().Where(s => s.IsEnabled).OrderBy(s => s.SortOrder).ToListAsync(),
                services = await db.Services.AsNoTracking().Where(s => s.IsEnabled).OrderBy(s => s.SortOrder).ToListAsync(),
                steps = await db.ProcessSteps.AsNoTracking().Where(s => s.IsEnabled).OrderBy(s => s.SortOrder).ToListAsync(),
                faqs = await db.FaqItems.AsNoTracking().Where(s => s.IsEnabled).OrderBy(s => s.SortOrder).ToListAsync(),
                examples = await db.TaskExamples.AsNoTracking().Where(s => s.IsEnabled).OrderBy(s => s.SortOrder).ToListAsync(),
                settings
            });
        });

        app.MapGet("/api/health", () => Results.Ok(new { ok = true, time = DateTime.UtcNow }));
    }
}
