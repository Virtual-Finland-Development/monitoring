namespace S3LogFileHandler.services;

public interface ILogService
{
    public void ProcessLogs(List<Dictionary<string, string>> logData);
}
