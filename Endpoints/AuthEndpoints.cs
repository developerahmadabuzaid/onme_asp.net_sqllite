using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OnMe.Api.Dtos;
using OnMe.Api.Models;
using OnMe.Api.Services;

namespace OnMe.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuth(this WebApplication app)
    {
        app.MapPost("/api/admin/login", async (
            [FromBody] LoginDto dto,
            UserManager<ApplicationUser> users,
            TokenService tokens) =>
        {
            var user = await users.FindByEmailAsync(dto.Email);
            if (user is null) return Results.Unauthorized();
            if (!await users.CheckPasswordAsync(user, dto.Password)) return Results.Unauthorized();
            var roles = await users.GetRolesAsync(user);
            return Results.Ok(new
            {
                token = tokens.CreateToken(user, roles),
                user = new { id = user.Id, email = user.Email, name = user.DisplayName, roles }
            });
        }).WithName("AdminLogin");
    }
}
