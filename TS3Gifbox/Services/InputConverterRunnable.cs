using System;
using System.Collections.Generic;
using System.Configuration;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TS3Gifbox.Entities;
using TS3Gifbox.Logging;
using TS3Gifbox.Services.Contracts;

namespace TS3Gifbox.Services
{
    class InputConverterRunnable : IRunnable
    {
        private readonly TraceSource _logger = null;
        private readonly IFileSystemWatcherService _fileSystemWatchService = null;
        private readonly IVideoConverterService _videoConverterService = null;

        public InputConverterRunnable(TraceSource logger,
            IFileSystemWatcherService fileSystemWatcherService,
            IVideoConverterService videoConverterService)
        {
            _logger = logger;
            _fileSystemWatchService = fileSystemWatcherService;
            _videoConverterService = videoConverterService;

            _logger.TraceInformation("Initializing InputConverterRunnable");
        }

        public async Task Run()
        {
            _logger.TraceInformation("Running InputConverterRunnable");
            
            string[] files = Directory.GetFiles(CupHolder.SourcePath);

            using (IFileSystemWatchdog watchdog = _fileSystemWatchService.SetupFileSystemWatch(CupHolder.SourcePath))
            {
                #region Startup Input Conversion
                using (LogicalOperationScope operation = new LogicalOperationScope("StartupInputConversion"))
                {
                    foreach (string file in files)
                    {
                        _logger.TraceEvent(TraceEventType.Information, 0, "Converting file {0}", file);

                        try
                        {
                            await _videoConverterService.ConvertFile(file);
                        }
                        catch (Exception e)
                        {
                            _logger.TraceEvent(TraceEventType.Error,
                                0,
                                CupHolder.Constants.ErrorMessages.Conversion,
                                file,
                                e);
                        }
                    }
                }
                #endregion

                #region Input file loop
                for (;;)
                {
                    using (LogicalOperationScope operation = new LogicalOperationScope("InputConversion"))
                    {
                        FileSystemNotificationModel notification = await watchdog.WaitForFileSystemChangeAsync();

                        _logger.TraceInformation("{0} | {1}", notification.ChangeType, notification.FilePath);

                        if (new[] { WatcherChangeTypes.Created, WatcherChangeTypes.Changed }.Contains(notification.ChangeType))
                        {
                            try
                            {
                                await _videoConverterService.ConvertFile(notification.FilePath);
                            }
                            catch (Exception e)
                            {
                                _logger.TraceEvent(TraceEventType.Error,
                                    0,
                                    CupHolder.Constants.ErrorMessages.Conversion,
                                    notification.FilePath,
                                    e);
                            }
                        }
                    }
                } 
                #endregion
            }
        }
    }
}
