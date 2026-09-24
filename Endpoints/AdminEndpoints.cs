using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OnMe.Api.Data;
using OnMe.Api.Dtos;
using OnMe.Api.Models;

namespace OnMe.Api.Endpoints;

public static class AdminEndpoints
{
    const string Policy = "AdminArea"; // SuperAdmin, Admin, Staff

    public static void MapAdmin(this WebApplication app)
    {
        var g = app.MapGroup("/api/admin").RequireAuthorization(Policy);

        // ===== Dashboard =====
        g.MapGet("/dashboard", async (AppDbContext db) =>
        {
            var @new = await db.Leads.CountAsync(l => l.Status == LeadStatuses.New);
            var reviewing = await db.Leads.CountAsync(l => l.Status == LeadStatuses.Reviewing);
            var inProgress = await db.Leads.CountAsync(l => l.Status == LeadStatuses.InProgress);
            var completed = await db.Leads.CountAsync(l => l.Status == LeadStatuses.Completed);
            var latest = await db.Leads.OrderByDescending(l => l.CreatedAt).Take(8)
                .Select(l => new { l.Id, l.RefCode, l.Name, l.Phone, l.Status, l.CreatedAt }).ToListAsync();
            return Results.Ok(new
            {
                counts = new { @new, reviewing, inProgress, completed },
                latest
            });
        });

        // ===== Leads =====
        g.MapGet("/leads", async (
            AppDbContext db,
            [FromQuery] string? status,
            [FromQuery] string? q,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20) =>
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var query = db.Leads.AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(l => l.Status == status);
            if (!string.IsNullOrWhiteSpace(q))
            {
                q = q.Trim();
                query = query.Where(l => l.Name.Contains(q) || l.Phone.Contains(q) || l.RefCode.Contains(q));
            }
            var total = await query.CountAsync();
            var items = await query.OrderByDescending(l => l.CreatedAt)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(l => new { l.Id, l.RefCode, l.Name, l.Phone, l.Location, l.Status, l.CreatedAt, l.UpdatedAt })
                .ToListAsync();
            return Results.Ok(new { total, page, pageSize, items });
        });

        g.MapGet("/leads/{id:int}", async (int id, AppDbContext db) =>
        {
            var lead = await db.Leads.Include(l => l.Notes).FirstOrDefaultAsync(l => l.Id == id);
            return lead is null ? Results.NotFound() : Results.Ok(lead);
        });

        g.MapPut("/leads/{id:int}", async (int id, [FromBody] UpdateLeadDto dto, AppDbContext db, ClaimsPrincipal user) =>
        {
            var lead = await db.Leads.FindAsync(id);
            if (lead is null) return Results.NotFound();
            if (dto.Status is not null)
            {
                if (!LeadStatuses.All.Contains(dto.Status))
                    return Results.BadRequest(new { message = "Invalid status." });
                lead.Status = dto.Status;
            }
            if (dto.AssignedToUserId is not null)
            {
                lead.AssignedToUserId = dto.AssignedToUserId;
                db.LeadAssignments.Add(new LeadAssignment
                {
                    LeadId = id,
                    AssignedToUserId = dto.AssignedToUserId,
                    AssignedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier),
                    CreatedAt = DateTime.UtcNow
                });
            }
            lead.UpdatedAt = DateTime.UtcNow;
            db.AuditLogs.Add(new AuditLog
            {
                UserId = user.FindFirstValue(ClaimTypes.NameIdentifier),
                Action = "update-lead",
                Entity = "Lead",
                EntityId = id.ToString()
            });
            await db.SaveChangesAsync();
            return Results.Ok(lead);
        });

        g.MapPost("/leads/{id:int}/notes", async (int id, [FromBody] CreateNoteDto dto, AppDbContext db, ClaimsPrincipal user) =>
        {
            if (!await db.Leads.AnyAsync(l => l.Id == id)) return Results.NotFound();
            var note = new LeadNote
            {
                LeadId = id,
                Body = dto.Body.Trim(),
                CreatedByUserId = user.FindFirstValue(ClaimTypes.NameIdentifier)
            };
            db.LeadNotes.Add(note);
            await db.SaveChangesAsync();
            return Results.Created($"/api/admin/leads/{id}/notes/{note.Id}", note);
        });

        // ===== Page content =====
        g.MapGet("/page-content", async (AppDbContext db) => Results.Ok(new
        {
            sections = await db.PageSections.OrderBy(s => s.SortOrder).ToListAsync(),
            services = await db.Services.OrderBy(s => s.SortOrder).ToListAsync(),
            steps = await db.ProcessSteps.OrderBy(s => s.SortOrder).ToListAsync(),
            faqs = await db.FaqItems.OrderBy(s => s.SortOrder).ToListAsync(),
            examples = await db.TaskExamples.OrderBy(s => s.SortOrder).ToListAsync(),
            settings = await db.SiteSettings.ToDictionaryAsync(s => s.Key, s => s.Value)
        }));

        g.MapPut("/page-content/sections/{id:int}", async (int id, [FromBody] UpsertSectionDto dto, AppDbContext db) =>
        {
            var s = await db.PageSections.FindAsync(id);
            if (s is null) return Results.NotFound();
            if (dto.Title is not null) s.Title = dto.Title;
            if (dto.Body is not null) s.Body = dto.Body;
            if (dto.CtaText is not null) s.CtaText = dto.CtaText;
            if (dto.CtaUrl is not null) s.CtaUrl = dto.CtaUrl;
            if (dto.IsEnabled.HasValue) s.IsEnabled = dto.IsEnabled.Value;
            await db.SaveChangesAsync();
            return Results.Ok(s);
        });

        // Services CRUD (مبسط)
        g.MapPost("/services", async ([FromBody] UpsertServiceDto dto, AppDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(dto.Title)) return Results.BadRequest(new { message = "Title required." });
            var s = new ServiceItem
            {
                Title = dto.Title!.Trim(),
                Description = dto.Description,
                Icon = dto.Icon,
                IsEnabled = dto.IsEnabled ?? true,
                SortOrder = dto.SortOrder ?? 0
            };
            db.Services.Add(s);
            await db.SaveChangesAsync();
            return Results.Created($"/api/admin/services/{s.Id}", s);
        });
        g.MapPut("/services/{id:int}", async (int id, [FromBody] UpsertServiceDto dto, AppDbContext db) =>
        {
            var s = await db.Services.FindAsync(id);
            if (s is null) return Results.NotFound();
            if (dto.Title is not null) s.Title = dto.Title;
            if (dto.Description is not null) s.Description = dto.Description;
            if (dto.Icon is not null) s.Icon = dto.Icon;
            if (dto.IsEnabled.HasValue) s.IsEnabled = dto.IsEnabled.Value;
            if (dto.SortOrder.HasValue) s.SortOrder = dto.SortOrder.Value;
            await db.SaveChangesAsync();
            return Results.Ok(s);
        });
        g.MapDelete("/services/{id:int}", async (int id, AppDbContext db) =>
        {
            var s = await db.Services.FindAsync(id);
            if (s is null) return Results.NotFound();
            db.Services.Remove(s);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // FAQs
        g.MapPost("/faqs", async ([FromBody] UpsertFaqDto dto, AppDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(dto.Question) || string.IsNullOrWhiteSpace(dto.Answer))
                return Results.BadRequest(new { message = "Question and answer required." });
            var f = new FaqItem { Question = dto.Question!.Trim(), Answer = dto.Answer!.Trim(), IsEnabled = dto.IsEnabled ?? true, SortOrder = dto.SortOrder ?? 0 };
            db.FaqItems.Add(f);
            await db.SaveChangesAsync();
            return Results.Created($"/api/admin/faqs/{f.Id}", f);
        });
        g.MapPut("/faqs/{id:int}", async (int id, [FromBody] UpsertFaqDto dto, AppDbContext db) =>
        {
            var f = await db.FaqItems.FindAsync(id);
            if (f is null) return Results.NotFound();
            if (dto.Question is not null) f.Question = dto.Question;
            if (dto.Answer is not null) f.Answer = dto.Answer;
            if (dto.IsEnabled.HasValue) f.IsEnabled = dto.IsEnabled.Value;
            if (dto.SortOrder.HasValue) f.SortOrder = dto.SortOrder.Value;
            await db.SaveChangesAsync();
            return Results.Ok(f);
        });
        g.MapDelete("/faqs/{id:int}", async (int id, AppDbContext db) =>
        {
            var f = await db.FaqItems.FindAsync(id);
            if (f is null) return Results.NotFound();
            db.FaqItems.Remove(f);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Task examples
        g.MapPost("/examples", async ([FromBody] UpsertExampleDto dto, AppDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(dto.Text))
                return Results.BadRequest(new { message = "Text required." });
            var e = new TaskExample { Text = dto.Text!.Trim(), IsEnabled = dto.IsEnabled ?? true, SortOrder = dto.SortOrder ?? 0 };
            db.TaskExamples.Add(e);
            await db.SaveChangesAsync();
            return Results.Created($"/api/admin/examples/{e.Id}", e);
        });
        g.MapPut("/examples/{id:int}", async (int id, [FromBody] UpsertExampleDto dto, AppDbContext db) =>
        {
            var e = await db.TaskExamples.FindAsync(id);
            if (e is null) return Results.NotFound();
            if (dto.Text is not null) e.Text = dto.Text;
            if (dto.IsEnabled.HasValue) e.IsEnabled = dto.IsEnabled.Value;
            if (dto.SortOrder.HasValue) e.SortOrder = dto.SortOrder.Value;
            await db.SaveChangesAsync();
            return Results.Ok(e);
        });
        g.MapDelete("/examples/{id:int}", async (int id, AppDbContext db) =>
        {
            var e = await db.TaskExamples.FindAsync(id);
            if (e is null) return Results.NotFound();
            db.TaskExamples.Remove(e);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // Settings
        g.MapPut("/settings/{key}", async (string key, [FromBody] UpsertSettingDto dto, AppDbContext db) =>
        {
            var s = await db.SiteSettings.FindAsync(key);
            if (s is null)
                db.SiteSettings.Add(new SiteSetting { Key = key, Value = dto.Value });
            else
            {
                s.Value = dto.Value;
                s.UpdatedAt = DateTime.UtcNow;
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { key, value = dto.Value });
        });

        // ===== Media =====
        var allowedExt = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png",
            [".webp"] = "image/webp", [".mp4"] = "video/mp4"
        };
        const long maxBytes = 50 * 1024 * 1024;

        g.MapPost("/media", async (IFormFile file, string? alt, AppDbContext db, IWebHostEnvironment env) =>
        {
            if (file is null || file.Length == 0) return Results.BadRequest(new { message = "No file." });
            var ext = Path.GetExtension(file.FileName);
            if (!allowedExt.ContainsKey(ext)) return Results.BadRequest(new { message = "Unsupported file type." });
            if (file.Length > maxBytes) return Results.BadRequest(new { message = "File too large (max 50MB)." });

            var uploads = Path.Combine(env.WebRootPath ?? "wwwroot", "uploads");
            Directory.CreateDirectory(uploads);
            var name = $"{Guid.NewGuid():N}{ext}";
            await using (var fs = File.Create(Path.Combine(uploads, name)))
                await file.CopyToAsync(fs);

            var kind = ext.Equals(".mp4", StringComparison.OrdinalIgnoreCase) ? "video" : "image";
            var media = new MediaFile
            {
                FileName = file.FileName,
                Url = "/uploads/" + name,
                ContentType = allowedExt[ext],
                SizeBytes = file.Length,
                Kind = kind,
                AltText = alt
            };
            db.MediaFiles.Add(media);
            await db.SaveChangesAsync();
            return Results.Created($"/api/admin/media/{media.Id}", media);
        }).DisableAntiforgery();

        g.MapGet("/media", async (AppDbContext db) =>
            Results.Ok(await db.MediaFiles.OrderByDescending(m => m.CreatedAt).Take(100).ToListAsync()));

        g.MapDelete("/media/{id:int}", async (int id, AppDbContext db, IWebHostEnvironment env) =>
        {
            var m = await db.MediaFiles.FindAsync(id);
            if (m is null) return Results.NotFound();
            var path = Path.Combine(env.WebRootPath ?? "wwwroot", m.Url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(path)) File.Delete(path);
            db.MediaFiles.Remove(m);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
