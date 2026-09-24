using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.IdentityModel.Tokens;
using OnMe.Api.Data;
using OnMe.Api.Endpoints;
using OnMe.Api.Models;
using OnMe.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ===== Config =====
var connStr = builder.Configuration.GetConnectionString("Default") ?? "Data Source=onme.db";

// ===== Services =====
// Pooled DbContext: instances are reused across requests instead of allocated per request.
// 32 is plenty for this site and caps what the pool keeps in memory (default 1024)
builder.Services.AddDbContextPool<AppDbContext>(opt =>
    opt.UseSqlite(connStr), poolSize: 32
);

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(o =>
{
    o.Password.RequiredLength = 8;
    o.Password.RequireNonAlphanumeric = false;
    o.Password.RequireUppercase = false;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

var jwt = builder.Configuration.GetSection("Jwt");
builder.Services.AddAuthentication(o =>
{
    o.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    o.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    o.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!))
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminArea", p => p.RequireRole("SuperAdmin", "Admin", "Staff"));

builder.Services.AddScoped<TokenService>();

// Prevent $ref cycles: Lead -> Notes -> Lead
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

builder.Services.AddRateLimiter(o =>
{
    o.AddPolicy("leads", http =>
        RateLimitPartition.GetFixedWindowLimiter(
            http.Connection.RemoteIpAddress?.ToString() ?? "anon",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
    o.RejectionStatusCode = 429;
});

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .AllowAnyOrigin()
    .AllowAnyHeader()
    .AllowAnyMethod()));

builder.Services.AddRazorPages();
// Swagger is only used in Development (see pipeline below): don't load it in production
if (builder.Environment.IsDevelopment())
{
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "OnMe API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        [new Microsoft.OpenApi.Models.OpenApiSecurityScheme
        {
            Reference = new Microsoft.OpenApi.Models.OpenApiReference
            {
                Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                Id = "Bearer"
            }
        }] = []
    });
});
}

var app = builder.Build();

await SeedData.EnsureSeededAsync(app.Services);

// ===== Pipeline =====
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseRateLimiter();

// Static: Razor Pages render the UI, wwwroot holds CSS/JS/PWA/media
var wwwroot = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
Directory.CreateDirectory(Path.Combine(wwwroot, "uploads"));
var contentTypes = new FileExtensionContentTypeProvider();
contentTypes.Mappings[".webmanifest"] = "application/manifest+json";
app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = contentTypes });

app.UseAuthentication();
app.UseAuthorization();

app.MapRazorPages();
app.MapGet("/admin.html", () => Results.Redirect("/Admin"));
app.MapPublic();
app.MapAuth();
app.MapAdmin();

app.Run();
