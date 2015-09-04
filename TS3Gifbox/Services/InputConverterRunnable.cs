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

            using (LogicalOperationScope operation = new LogicalOperationScope("StartupInputConversion"))
            {
                foreach (string file in files)
                {
                    _logger.TraceEvent(TraceEventType.Information, 0, "Converting file {0}", file);

                    await _videoConverterService.Convert(file);


                }
            }

            for (;;)
            {
                using (IFileSystemWatchdog watchdog = _fileSystemWatchService.SetupFileSystemWatch(CupHolder.SourcePath))
                {
                    using (LogicalOperationScope operation = new LogicalOperationScope("InputConversion"))
                    {
                        FileSystemNotificationModel notification = await watchdog.WaitForFileSystemChangeAsync();

                        _logger.TraceInformation("{0} | {1}", notification.ChangeType, notification.FilePath);

                        await _videoConverterService.Convert(notification.FilePath);
                    }
                }
            }
        }
    }
}
