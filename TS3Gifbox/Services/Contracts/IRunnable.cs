using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TS3Gifbox.Services.Contracts
{
    public interface IRunnable
    {
        /// <summary>
        /// Runs.
        /// </summary>
        Task Run();
    }
}
