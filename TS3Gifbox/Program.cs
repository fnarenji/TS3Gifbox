using System.Linq;
using System.Threading.Tasks;
using SimpleInjector;
using System.Diagnostics;
using TS3Gifbox.Services;
using TS3Gifbox.Services.Contracts;
using TS3Gifbox.Entities;
using System.Configuration;
using System.IO;
using System;

namespace TS3Gifbox
{
    class Program 
    {
        static void Main(string[] args)
        {
            // Logging
            TraceSource traceSource = new TraceSource("TS3Gifbox");
            traceSource.TraceInformation("Starting TS3Gifbox...");

            #region CupHolda
            CupHolder.SourcePath = ConfigurationManager.AppSettings["source"];
            CupHolder.TargetPath = ConfigurationManager.AppSettings["target"];

            if (!Directory.Exists(CupHolder.SourcePath))
            {
                traceSource.TraceEvent(TraceEventType.Critical, 0,
                    "The source folder does not exist ({0}).",
                    CupHolder.SourcePath);

                return;
            }

            traceSource.TraceEvent(TraceEventType.Information, 0, "Source path: {0}", CupHolder.SourcePath);

            if (!Directory.Exists(CupHolder.TargetPath))
            {
                traceSource.TraceEvent(TraceEventType.Warning, 0,
                    "The target folder does not exist ({0}).",
                    CupHolder.TargetPath);

                try
                {
                    traceSource.TraceEvent(TraceEventType.Verbose, 0, "Creating target folder");
                    Directory.CreateDirectory(CupHolder.TargetPath);
                    traceSource.TraceEvent(TraceEventType.Information, 0, "Created target folder");
                }
                catch (Exception e)
                {
                    traceSource.TraceEvent(TraceEventType.Critical, 0, "An error happened while creating the target directory. Details: {0}", e);
                    return;
                }
            }
            #endregion

            #region FFmpeg

            traceSource.TraceEvent(TraceEventType.Information, 0, "Target path: {0}", CupHolder.TargetPath);

            if (!File.Exists(CupHolder.Constants.FFMpegExecutablePath))
            {
                traceSource.TraceEvent(TraceEventType.Error, 0,
                    "The executable file for FFMpeg ({0}) was not present in the working directory ({1}).",
                    CupHolder.Constants.FFMpegExecutablePath,
                    Environment.CurrentDirectory);

                return;
            }
            #endregion

            #region IoC Container
            Container container = new Container();

            // Logger
            container.RegisterSingleton<TraceSource>(traceSource);

            // Services
            container.Register<IFileSystemWatcherService, FileSystemWatcherService>(Lifestyle.Singleton);

            // Runnables
            container.RegisterCollection<IRunnable>(new[] {
                typeof(InputConverterRunnable)
            });

            container.Verify();

            #endregion

            var tasks = container.GetAllInstances<IRunnable>()
                .Select(r => Task.Run(async () => {
                    await r.Run();
            }));

            Task.WaitAll(tasks.ToArray());
        }
    }
}
