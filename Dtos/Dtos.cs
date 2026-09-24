using System.ComponentModel.DataAnnotations;

namespace OnMe.Api.Dtos;

// POST /api/leads — §16.8
public record CreateLeadDto(
    [Required, MinLength(2), MaxLength(120)] string Name,
    [Required, RegularExpression(@"^05\d{8}$", ErrorMessage = "Phone must match 05XXXXXXXX")] string Phone,
    [Required, MinLength(10), MaxLength(5000)] string Description,
    string? Location // inside_saudi | outside_saudi | unsure
);

public record UpdateLeadDto(string? Status, string? AssignedToUserId);
public record CreateNoteDto([Required, MinLength(1), MaxLength(2000)] string Body);
public record LoginDto([Required] string Email, [Required] string Password);

public record UpsertSectionDto(string? Title, string? Body, string? CtaText, string? CtaUrl, bool? IsEnabled);
public record UpsertServiceDto(string? Title, string? Description, string? Icon, bool? IsEnabled, int? SortOrder);
public record UpsertStepDto(string? Title, string? Description, bool? IsEnabled, int? SortOrder);
public record UpsertFaqDto(string? Question, string? Answer, bool? IsEnabled, int? SortOrder);
public record UpsertExampleDto(string? Text, bool? IsEnabled, int? SortOrder);
public record UpsertSettingDto(string Value);
