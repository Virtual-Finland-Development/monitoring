FROM mcr.microsoft.com/dotnet/runtime:6.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build
WORKDIR /src
COPY ["cloudfront-log-forwarder/cloudfront-log-forwarder.csproj", "cloudfront-log-forwarder/"]
RUN dotnet restore "cloudfront-log-forwarder/cloudfront-log-forwarder.csproj"
COPY . .
WORKDIR "/src/cloudfront-log-forwarder"
RUN dotnet build "cloudfront-log-forwarder.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "cloudfront-log-forwarder.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "cloudfront-log-forwarder.dll"]
